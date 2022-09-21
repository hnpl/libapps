// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "js_file.h"

#include <algorithm>

#include <assert.h>
#include <string.h>

#include "ppapi/cpp/module.h"

#include "file_system.h"
#include "proxy_stream.h"

termios JsFile::tio_ = {};

JsFileHandler::JsFileHandler(OutputInterface* out)
    : ref_(1), factory_(this), out_(out) {
}

JsFileHandler::~JsFileHandler() {
  assert(!ref_);
}

void JsFileHandler::addref() {
  ++ref_;
}

void JsFileHandler::release() {
  if (!--ref_)
    delete this;
}

void JsFileHandler::Open(int32_t result, JsFile* stream, const char* pathname) {
  out_->OpenFile(stream->fd(), pathname, stream->oflag(), stream);
}

FileStream* JsFileHandler::open(int fd, const char* pathname, int oflag,
                                int* err) {
  JsFile* stream = new JsFile(fd, (oflag & ~O_NONBLOCK), out_);
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&JsFileHandler::Open, stream, pathname));

  FileSystem* sys = FileSystem::GetFileSystem();
  while (!stream->is_open())
    sys->cond().wait(sys->mutex());

  if (stream->fd() == -1) {
    stream->release();
    return NULL;
  }

  return stream;
}

int JsFileHandler::stat(const char* pathname, nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

//------------------------------------------------------------------------------

JsFile::JsFile(int fd, int oflag, OutputInterface* out)
  : ref_(1), fd_(fd), oflag_(oflag), out_(out),
    factory_(this), out_task_sent_(false), is_open_(false),
    is_atty_(false), is_read_ready_(false),
    write_sent_(0), write_acknowledged_(0),
    on_read_call_count_(0) {
}

JsFile::~JsFile() {
  assert(!ref_);
}

void JsFile::OnOpen(bool success, bool is_atty) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  is_open_ = true;
  is_atty_ = is_atty;
  if (!success)
    fd_ = -1;
  sys->cond().broadcast();
}

void JsFile::OnRead(const char* buf, size_t size) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  if (isatty()) {
    for (size_t i = 0; i < size; i++) {
      char c = buf[i];
      // Transform characters according to input flags.
      if (c == '\r') {
        if (tio_.c_iflag & IGNCR)
          continue;
        if (tio_.c_iflag & ICRNL)
          c = '\n';
      } else if (c == '\n') {
        if (tio_.c_iflag & INLCR)
          c = '\r';
      }
      if (tio_.c_lflag & ICANON) {
        if ((tio_.c_lflag & ECHOE) && c == tio_.c_cc[VERASE]) {
          // Remove previous character in the line if any.
          // TODO(davidben): This should be IUTF8-aware.
          if (!in_buf_.empty() && in_buf_.back() != '\n') {
            in_buf_.pop_back();
            if (tio_.c_lflag & ECHO)
              ::write(fd_, "\b \b", 3);
          }
          continue;
        } else if ((tio_.c_lflag & ECHO) ||
                   ((tio_.c_lflag & ECHONL) && c == '\n')) {
          ::write(fd_, &c, 1);
        }
      } else if (tio_.c_lflag & ECHO) {
        ::write(fd_, &c, 1);
      }
      in_buf_.push_back(c);
    }
  } else {
    in_buf_.insert(in_buf_.end(), buf, buf + size);
  }
  on_read_call_count_++;
  sys->cond().broadcast();
}

void JsFile::OnWriteAcknowledge(uint64_t count) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  assert(write_acknowledged_ <= write_sent_);
  write_acknowledged_ = count;
  PostWriteTask(false);
  sys->cond().broadcast();
}

void JsFile::OnClose() {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  is_open_ = false;
  sys->cond().broadcast();
}

void JsFile::OnReadReady(bool is_read_ready) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  is_read_ready_ = is_read_ready;
  sys->cond().broadcast();
}

void JsFile::addref() {
  ++ref_;
}

void JsFile::release() {
  if (!--ref_)
    delete this;
}

FileStream* JsFile::dup(int fd) {
  return new ProxyStream(fd, oflag_, this);
}

void JsFile::close() {
  if (is_open()) {
    assert(fd_ >= 3);
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&JsFile::Close));

    FileSystem* sys = FileSystem::GetFileSystem();
    while (out_task_sent_)
      sys->cond().wait(sys->mutex());
    while (is_open_)
      sys->cond().wait(sys->mutex());

    fd_ = -1;
  }
}

int JsFile::read(char* buf, size_t count, size_t* nread) {
  if (is_open() && in_buf_.empty()) {
    pp::Module::Get()->core()->CallOnMainThread(0,
        factory_.NewCallback(&JsFile::Read, count));
  }

  FileSystem* sys = FileSystem::GetFileSystem();
  if (is_block()) {
    while (is_open() && in_buf_.empty())
      sys->cond().wait(sys->mutex());
  } else if (is_read_ready_) {
    // We will still "block" waiting for data from JavaScript if we believe
    // that the data is readily available and just needs to be sent over. If
    // is_read_ready_ becomes false while we're waiting (another reader gets
    // the data first), we'll exit the loop with whatever data is available in
    // in_buf_. If in_buf_ is still empty, the loop below will be exited and
    // return -1, EAGAIN.
    while (is_open() && in_buf_.empty() && is_read_ready_)
      sys->cond().wait(sys->mutex());
  }

  if (isatty() && (tio_.c_lflag & ICANON)) {
    // Need to wait for the whole line. This code doesn't introduce performance
    // issue because ICANON is used only during local ssh prompts, ssh session
    // use raw TTY mode.
    // TODO(dpolukhin): find better way to detect whole line.
    while (true) {
      if (!is_open())
        break;

      if (std::find(in_buf_.begin(), in_buf_.end(), '\n') != in_buf_.end()) {
        break;
      }

      while (is_open() && !is_read_ready_)
        sys->cond().wait(sys->mutex());

      uint64_t old_on_read_call_count = on_read_call_count_;
      pp::Module::Get()->core()->CallOnMainThread(
          0, factory_.NewCallback(&JsFile::Read, 1));

      while (is_open() && on_read_call_count_ == old_on_read_call_count)
        sys->cond().wait(sys->mutex());
    }
  }

  *nread = 0;
  while (*nread < count) {
    if (in_buf_.empty())
      break;

    buf[(*nread)++] = in_buf_.front();
    in_buf_.pop_front();
  }

  if (*nread == 0 && !is_block() && is_open()) {
    *nread = -1;
    return EAGAIN;
  }

  return 0;
}

int JsFile::write(const char* buf, size_t count, size_t* nwrote) {
  if (!is_open())
    return EIO;

  out_buf_.insert(out_buf_.end(), buf, buf + count);

  if (isatty() && (tio_.c_oflag & OPOST) && (tio_.c_oflag & ONLCR)) {
    // It could be performance issue to do this conversion in-place but
    // fortunately it's used only for first few lines like password prompt.
    for (size_t i = out_buf_.size() - count; i < out_buf_.size(); i++) {
      if (out_buf_[i] == '\n') {
        out_buf_.insert(out_buf_.begin() + i++, '\r');
      }
    }
  }

  *nwrote = count;
  PostWriteTask(true);
  return 0;
}

int JsFile::fstat(nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  // openssl uses st_ino and st_dev to distinguish random sources and doesn't
  // expect 0 there.
  out->nacl_abi_st_ino = fd_;
  out->nacl_abi_st_dev = fd_;
  return 0;
}

int JsFile::isatty() {
  return is_atty_;
}

void JsFile::InitTerminal() {
  // Some reasonable values that produce good result.
  tio_.c_iflag = ICRNL | IXON | IXOFF | IUTF8;
  tio_.c_oflag = OPOST | ONLCR;
  tio_.c_cflag = CREAD | 077;
  tio_.c_lflag =
      ISIG | ICANON | ECHO | ECHOE | ECHOK | ECHOCTL | ECHOKE | IEXTEN;
  tio_.c_ispeed = B38400;
  tio_.c_ospeed = B38400;
  tio_.c_cc[VINTR] = 3;
  tio_.c_cc[VQUIT] = 28;
  tio_.c_cc[VERASE] = 127;
  tio_.c_cc[VKILL] = 21;
  tio_.c_cc[VEOF] = 4;
  tio_.c_cc[VTIME] = 0;
  tio_.c_cc[VMIN] = 1;
  tio_.c_cc[VSWTC] = 0;
  tio_.c_cc[VSTART] = 17;
  tio_.c_cc[VSTOP] = 19;
  tio_.c_cc[VSUSP] = 26;
  tio_.c_cc[VEOL] = 0;
  tio_.c_cc[VREPRINT] = 18;
  tio_.c_cc[VDISCARD] = 15;
  tio_.c_cc[VWERASE] = 23;
  tio_.c_cc[VLNEXT] = 22;
  tio_.c_cc[VEOL2] = 0;
}

int JsFile::tcgetattr(termios* termios_p) {
  *termios_p = tio_;
  return 0;
}

int JsFile::tcsetattr(int optional_actions, const termios* termios_p) {
  tio_ = *termios_p;
  return 0;
}

int JsFile::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}

int JsFile::ioctl(int request, va_list ap) {
  if (request == TIOCGWINSZ) {
    FileSystem* sys = FileSystem::GetFileSystem();
    winsize* argp = va_arg(ap, winsize*);
    if (sys->GetTerminalSize(&argp->ws_col, &argp->ws_row)) {
      argp->ws_xpixel = 0;
      argp->ws_ypixel = 0;
      return 0;
    }
  }
  return -1;
}

bool JsFile::is_read_ready() {
  return is_read_ready_ || !in_buf_.empty();
}

bool JsFile::is_write_ready() {
  size_t not_acknowledged = write_sent_ - write_acknowledged_;
  return (not_acknowledged + out_buf_.size()) < out_->GetWriteWindow();
}

void JsFile::PostWriteTask(bool always_post) {
  if (!out_task_sent_ && !out_buf_.empty() &&
      (write_sent_ - write_acknowledged_) < out_->GetWriteWindow()) {
    if (always_post || !pp::Module::Get()->core()->IsMainThread()) {
      pp::Module::Get()->core()->CallOnMainThread(
          0, factory_.NewCallback(&JsFile::Write));
      out_task_sent_ = true;
    } else {
      // If on main Pepper thread and delay is not required call it directly.
      Write(PP_OK);
    }
  }
}

void JsFile::Read(int32_t result, size_t size) {
  out_->Read(fd_, size);
}

void JsFile::Write(int32_t result) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  out_task_sent_ = false;

  size_t count = std::min(
      size_t(write_acknowledged_ + out_->GetWriteWindow() - write_sent_),
      out_buf_.size());
  if (count == 0) {
    LOG("JsFile::Write: %d is not ready for write, cached %d\n",
        fd_, out_buf_.size());
    return;
  }

  // Use temporary buffer in vector because std::deque doesn't use continuous
  // memory inside. Alternative solution is to use vector as out_buf_ but erase
  // below will require copy for the whole remaining bytes (will be slow with
  // small writeWindow).
  std::vector<char> buf(out_buf_.begin(), out_buf_.begin() + count);
  if (out_->Write(fd_, &buf[0], count)) {
    write_sent_ += count;
    out_buf_.erase(out_buf_.begin(), out_buf_.begin() + count);
    sys->cond().broadcast();
  } else {
    assert(0);
    PostWriteTask(true);
  }
}

void JsFile::Close(int32_t result) {
  out_->Close(fd_);
}

//------------------------------------------------------------------------------

JsSocket::JsSocket(int fd, int oflag, OutputInterface* out)
  : JsFile(fd, oflag, out), factory_(this) {
}

JsSocket::~JsSocket() {
}

bool JsSocket::connect(const char* host, uint16_t port) {
  pp::Module::Get()->core()->CallOnMainThread(0,
      factory_.NewCallback(&JsSocket::Connect, host, port));
  FileSystem* sys = FileSystem::GetFileSystem();
  while (!is_open())
    sys->cond().wait(sys->mutex());

  if (fd() == -1)
    return false;

  return true;
}

int JsSocket::isatty() {
  return false;
}

bool JsSocket::is_read_ready() {
  return !in_buf_.empty();
}

void JsSocket::Connect(int32_t result, const char* host, uint16_t port) {
  FileSystem* sys = FileSystem::GetFileSystem();
  Mutex::Lock lock(sys->mutex());
  out_->OpenSocket(fd_, host, port, this);
}
