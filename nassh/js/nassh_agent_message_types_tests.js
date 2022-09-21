// Copyright 2017 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Test suite for the SSH agent message handling primitives in
 * nassh.agent.messages.
 */

import {MessageNumbers, decodeCurveOidWithVendorFixes, decodeOid,
        writeMessage} from './nassh_agent_message_types.js';

describe('nassh_agent_message_types_tests.js', () => {

// clang-format off
it('write_identitiesAnswer', /** @suppress {visibility} msg.data_ */ () => {
  const identitiesAnswerMsg = writeMessage(
      MessageNumbers.AGENT_IDENTITIES_ANSWER, [
        {
          keyBlob: new Uint8Array([1, 2]),
          comment: new Uint8Array([3, 4, 5]),
        },
        {
          keyBlob: new Uint8Array([6, 7, 8, 9]),
          comment: new Uint8Array(0),
        },
      ]);
  assert.strictEqual(
      identitiesAnswerMsg.type,
      MessageNumbers.AGENT_IDENTITIES_ANSWER,
      'type (SSH_AGENT_IDENTITIES_ANSWER)');
  assert.deepStrictEqual(
      Array.from(identitiesAnswerMsg.data_),
      [
        0, 0, 0, 2, 0, 0, 0, 2, 1, 2, 0, 0, 0, 3, 3,
        4, 5, 0, 0, 0, 4, 6, 7, 8, 9, 0, 0, 0, 0,
      ],
      'data (SSH_AGENT_IDENTITIES_ANSWER)');
});
// clang-format on

it('write_signResponse', /** @suppress {visibility} msg.data_ */ () => {
  const signResponseMsg = writeMessage(
      MessageNumbers.AGENT_SIGN_RESPONSE,
      new Uint8Array([1, 2, 3, 4]));
  assert.strictEqual(
      signResponseMsg.type, MessageNumbers.AGENT_SIGN_RESPONSE,
      'type (SSH_AGENT_SIGN_RESPONSE)');
  assert.deepStrictEqual(
      Array.from(signResponseMsg.data_), [0, 0, 0, 4, 1, 2, 3, 4],
      'data (SSH_AGENT_SIGN_RESPONSE)');
});

it('decodeOid', () => {
  assert.isNull(decodeOid(new Uint8Array([])));
  assert.strictEqual(decodeOid(new Uint8Array([0x2B])), '1.3');
  assert.isNull(decodeOid(new Uint8Array([0x2B, 0x80])));
  assert.strictEqual(
      decodeOid(new Uint8Array(
          [0x2B, 0x24, 0x03, 0x03, 0x02, 0x08, 0x01, 0x01, 0x07])),
      '1.3.36.3.3.2.8.1.1.7');
  assert.strictEqual(
      decodeOid(
          new Uint8Array([0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07])),
      '1.2.840.10045.3.1.7');
});

it('decodeCurveOidWithVendorFixes', () => {
  const OID_ED25519 = '1.3.6.1.4.1.11591.15.1';
  const RAW_OID_ED25519 = new Uint8Array(
      [0x2B, 0x06, 0x01, 0x04, 0x01, 0xDA, 0x47, 0x0F, 0x01]);
  const RAW_OID_ED25519_YK_1 = new Uint8Array(
      [0x2B, 0x06, 0x01, 0x04, 0x01, 0xDA, 0x47, 0x0F, 0x01, 0x00]);
  const RAW_OID_ED25519_YK_2 = new Uint8Array(
      [0x2B, 0x06, 0x01, 0x04, 0x01, 0xDA, 0x47, 0x0F, 0x01, 0x09]);
  const RAW_OID_ED25519_YK_3 = new Uint8Array(
      [0x2B, 0x06, 0x01, 0x04, 0x01, 0xDA, 0x47, 0x0F, 0x01, 0xFF]);

  assert.strictEqual(decodeCurveOidWithVendorFixes(
      RAW_OID_ED25519, 'generic'), OID_ED25519);
  assert.notStrictEqual(decodeCurveOidWithVendorFixes(
      RAW_OID_ED25519_YK_1, 'generic'), OID_ED25519);
  assert.notStrictEqual(decodeCurveOidWithVendorFixes(
      RAW_OID_ED25519_YK_2, 'generic'), OID_ED25519);
  assert.notStrictEqual(decodeCurveOidWithVendorFixes(
      RAW_OID_ED25519_YK_3, 'generic'), OID_ED25519);

  assert.strictEqual(decodeCurveOidWithVendorFixes(
      RAW_OID_ED25519, 'Yubico YubiKey 42'), OID_ED25519);
  assert.strictEqual(decodeCurveOidWithVendorFixes(
      RAW_OID_ED25519_YK_1, 'Yubico YubiKey 42'), OID_ED25519);
  assert.strictEqual(decodeCurveOidWithVendorFixes(
      RAW_OID_ED25519_YK_2, 'Yubico YubiKey 42'), OID_ED25519);
  assert.strictEqual(decodeCurveOidWithVendorFixes(
      RAW_OID_ED25519_YK_3, 'Yubico YubiKey 42'), OID_ED25519);
});

});
