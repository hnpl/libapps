// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview General message handling in accordance with the SSH agent
 * protocol.
 */

import {MessageNumbers, readMessage} from './nassh_agent_message_types.js';

/**
 * Create an SSH agent message from a raw byte array containing the message
 * contents.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4
 * @param {!MessageNumbers} type The type of the message as per
 *     Section 7.1 of the specification.
 * @param {!Uint8Array=} data The raw data of the message, if any.
 * @constructor
 */
export function Message(type, data = new Uint8Array(0)) {
  /**
   * Type of the message.
   *
   * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.7.1
   * @type {!MessageNumbers}
   */
  this.type = type;

  /**
   * The raw data of the message.
   *
   * @private {!Uint8Array}
   */
  this.data_ = data;

  /**
   * The current offset into the raw message data. This is only used when
   * reading raw messages (i.e. requests).
   *
   * @private {number}
   */
  this.offset_ = 0;

  /**
   * The fields encoded in the message data. This is only used when reading raw
   * messages (i.e. requests) that contain data.
   *
   * @type {!Object}
   */
  this.fields = {};
}

/**
 * Get the raw, length-encoded representation of the message.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.3
 * @return {!Uint8Array}
 */
Message.prototype.rawMessage = function() {
  const buffer = new ArrayBuffer(5);
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(buffer);
  dv.setUint32(0, 1 + this.data_.length);
  u8[4] = this.type;
  return lib.array.concatTyped(u8, this.data_);
};

/**
 * Check whether the end of the raw message data has been reached.
 *
 * @return {boolean} true if the end of the raw message data has been reached;
 *  false otherwise.
 */
Message.prototype.eom = function() {
  return this.offset_ === this.data_.length;
};

/**
 * Read a uint32 from the raw message data.
 *
 * @see https://tools.ietf.org/html/rfc4251#section-5
 * @throws Will throw an error if there are less than four more bytes available.
 * @return {number}
 */
Message.prototype.readUint32 = function() {
  if (this.data_.length < this.offset_ + 4) {
    throw new Error('Message.readUint32: end of data_ reached prematurely');
  }
  const dv = new DataView(this.data_.buffer, this.data_.byteOffset);
  const uint32 = dv.getUint32(this.offset_);
  this.offset_ += 4;
  return uint32;
};

/**
 * Write a uint32 to the raw message data.
 *
 * @see https://tools.ietf.org/html/rfc4251#section-5
 * @param {number} uint32 An unsigned 32-bit integer.
 */
Message.prototype.writeUint32 = function(uint32) {
  if (!Number.isSafeInteger(uint32)) {
    throw new Error(`Message.writeUint32: ${uint32} is not a (safe) integer`);
  }
  const buffer = new ArrayBuffer(4);
  const dv = new DataView(buffer);
  dv.setUint32(0, uint32);
  this.data_ = lib.array.concatTyped(this.data_, new Uint8Array(buffer));
};

/**
 * Read a string from the raw message data.
 *
 * @see https://tools.ietf.org/html/rfc4251#section-5
 * @throws Will throw an error if there are less bytes available than indicated
 *    by the length field.
 * @return {!Uint8Array}
 */
Message.prototype.readString = function() {
  const length = this.readUint32();
  if (this.data_.length < this.offset_ + length) {
    throw new Error('Message.readString: end of data_ reached prematurely');
  }
  const string = this.data_.slice(this.offset_, this.offset_ + length);
  this.offset_ += length;
  return string;
};

/**
 * Write a string to the raw message data.
 *
 * @see https://tools.ietf.org/html/rfc4251#section-5
 * @param {!Uint8Array} string
 */
Message.prototype.writeString = function(string) {
  if (!(string instanceof Uint8Array)) {
    throw new Error('Message.writeString: string is not of type Uint8Array');
  }
  const length = string.length;
  this.writeUint32(length);
  this.data_ = lib.array.concatTyped(this.data_, string);
};

/**
 * Parse a raw SSH agent message into a Message object.
 *
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.3
 * @see https://tools.ietf.org/id/draft-miller-ssh-agent-00.html#rfc.section.4
 * @constructs Message
 * @param {!Uint8Array} rawMessage
 * @return {?Message} A Message object created from the raw message
 *     data; null if the raw message data is malformed.
 */
Message.fromRawMessage = function(rawMessage) {
  if (rawMessage.length < 5) {
    return null;
  }
  const dv = new DataView(rawMessage.buffer, rawMessage.byteOffset);
  const length = dv.getUint32(0);
  if (length + 4 !== rawMessage.length) {
    return null;
  }
  const message = new Message(
      /** @type {!MessageNumbers} */ (rawMessage[4]), rawMessage.slice(5));
  return readMessage(message);
};
