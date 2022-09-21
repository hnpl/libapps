// Copyright 2012 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "dev_null.h"

#include <assert.h>
#include <string.h>

DevNullHandler::DevNullHandler() : ref_(1) {
}

DevNullHandler::~DevNullHandler() {
  assert(!ref_);
}

void DevNullHandler::addref() {
  ++ref_;
}

void DevNullHandler::release() {
  if (!--ref_)
    delete this;
}

FileStream* DevNullHandler::open(int fd, const char* pathname, int oflag,
                                 int* err) {
  return new DevNull(fd, oflag);
}

int DevNullHandler::stat(const char* pathname, nacl_abi_stat* out) {
  memset(out, 0, sizeof(nacl_abi_stat));
  return 0;
}

//------------------------------------------------------------------------------

DevNull::DevNull(int fd, int oflag)
  : fd_(fd), oflag_(oflag), ref_(1) {
}

DevNull::~DevNull() {
  assert(!ref_);
}

void DevNull::addref() {
  ++ref_;
}

void DevNull::release() {
  if (!--ref_)
    delete this;
}

FileStream* DevNull::dup(int fd) {
  return new DevNull(fd, oflag_);
}

void DevNull::close() {
  fd_ = 0;
}

int DevNull::read(char* buf, size_t count, size_t* nread) {
  *nread = 0;
  return 0;
}

int DevNull::write(const char* buf, size_t count, size_t* nwrote) {
  *nwrote = count;
  return 0;
}

int DevNull::fcntl(int cmd, va_list ap) {
  if (cmd == F_GETFL) {
    return oflag_;
  } else if (cmd == F_SETFL) {
    oflag_ = va_arg(ap, long);
    return 0;
  } else {
    return -1;
  }
}
