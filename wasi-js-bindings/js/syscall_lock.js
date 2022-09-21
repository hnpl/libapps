// Copyright 2020 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Shared locking structure suitable for synchronising syscalls
 * between webworkers.
 */

/**
 * A magic string to mark bigints serialized in JSON as a string.
 */
const BIGINT_MAGIC = '_WASI\x00BigInt\x01';

/**
 * Locking type that's more analagous to a Win32-style signal. This class
 * creates locking semantics and a return code around a piece of shared memory
 * supplied at construction time. This lets two threads share a communications
 * channel, as one thread can lock() and wait() while another thread performs
 * the unlock() when execution in the original thread should continue.
 */
export class SyscallLock {
  /**
   * Creates an instance of SyscallLock.
   *
   * @param {!SharedArrayBuffer} buffer Shared memory for this lock.
   * @param {number=} offset
   */
  constructor(buffer, offset = 0) {
    // Constants for keeping track of the locked state.
    this.UNLOCKED = 0;
    this.LOCKED = 1;

    // NB: We don't verify offset, or buffer length, of offset alignment as
    // Int32Array does it for us.
    if (!(buffer instanceof SharedArrayBuffer)) {
      throw new Error('buffer must be a SharedArrayBuffer');
    }

    // Space for integers shared memory.
    this.sabArr = new Int32Array(buffer, offset, 3);
    // Offset of the lock itself.
    this.lockIndex = 0;
    // Offset of the return value.
    this.retcodeIndex = 1;
    // Offset of the data object.
    this.dataLengthIndex = 2;

    // The space for passing shared objects around.
    this.sabDataArr = new Uint8Array(buffer, offset + this.sabArr.byteLength,
                                     64 * 1024 - this.sabArr.byteLength);
  }

  /**
   * Sets |lockIndex| to LOCKED, the caller must *not* already hold the lock
   * when making this call.
   *
   * @return {boolean} True if the lock was acquired, False otherwise.
   */
  lock() {
    // TODO(ajws@): Check if the lock is already held.
    return Atomics.compareExchange(
        this.sabArr, this.lockIndex, this.UNLOCKED, this.LOCKED) ===
        this.UNLOCKED;
  }

  /**
   * Blocks execution of the caller while lockIndex remains in the LOCKED
   * state.
   */
  wait() {
    Atomics.wait(this.sabArr, this.lockIndex, this.LOCKED);
  }

  /**
   * Unlock lockIndex, this does not check to see if the lock is currenly held
   * by anyone.
   */
  unlock() {
    Atomics.store(this.sabArr, this.lockIndex, this.UNLOCKED);
    Atomics.notify(this.sabArr, this.lockIndex);
  }

  /**
   * Set the return code for a syscall.
   *
   * @param {number} retcode Must be be able to fit into an Int32, should be one
   *     of the values of ./wasi/errno.js.
   */
  setRetcode(retcode) {
    Atomics.store(this.sabArr, this.retcodeIndex, retcode);
  }

  /**
   * Get the returncode of the last syscall made using this lock.
   *
   * @return {number} A syscall result from ./wasi/errno.js.
   */
  getRetcode() {
    const ret = Atomics.load(this.sabArr, this.retcodeIndex);
    return ret;
  }

  /**
   * Serialize complicated objects for passing via shared memory.
   *
   * This uses JSON internally, so objects should not be complicated, and they
   * need to fit within 64KiB.
   *
   * @param {!Object} obj The object to serialize.
   */
  setData(obj) {
    const te = new TextEncoder();
    /** @suppress {checkTypes} https://github.com/google/closure-compiler/issues/3701 */
    const str = JSON.stringify(obj, (key, value) => {
      switch (typeof value) {
        case 'bigint':
          return BIGINT_MAGIC + value.toString();
        case 'object':
          if (ArrayBuffer.isView(value)) {
            return Array.from(value);
          }
        default:
          return value;
      }
    });
    // TODO(crbug.com/1012656): Chrome's encodeInto doesn't support shared array
    // buffers yet.
    const bytes = te.encode(str);
    this.sabDataArr.set(bytes);
    this.sabArr[this.dataLengthIndex] = bytes.length;
  }

  /**
   * Deserialize complicated objects.
   *
   * @return {?Object} The object returned by the syscall handler, or null if
   *    there is no object passed back.
   */
  getData() {
    const length = this.sabArr[this.dataLengthIndex];
    if (!length) {
      return null;
    }

    const td = new TextDecoder();
    // We have to use slice to get a copy as decode doesn't support shared array
    // buffers yet.
    const bytes = this.sabDataArr.slice(0, length);
    const ret = JSON.parse(td.decode(bytes), (key, value) => {
      return (typeof value === 'string' && value.startsWith(BIGINT_MAGIC)) ?
          BigInt(value.substr(BIGINT_MAGIC.length)) : value;
    });
    if (!(ret instanceof Object)) {
      throw new Error(`Invalid serialized object`);
    }
    return ret;
  }
}
