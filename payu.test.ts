import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  PAYU_AMOUNT_STR,
  PAYU_LIVE_ACTION_URL,
  PAYU_PRODUCT_INFO,
  PAYU_TEST_ACTION_URL,
  computePayURequestHash,
  computePayUResponseHash,
  getPayUActionUrl,
  verifyPayUResponseHash,
} from './payu';

test('computePayURequestHash produces exact official PayU SHA-512 digest', () => {
  const params = {
    key: 'gtKFFx',
    txnid: 'PW1700000000ABCD',
    amount: PAYU_AMOUNT_STR,
    productinfo: PAYU_PRODUCT_INFO,
    firstname: 'Aarav',
    email: 'aarav@example.com',
    udf1: 'student-123',
  };
  const salt = 'eCwWELxi';
  const expected = crypto
    .createHash('sha512')
    .update(
      `gtKFFx|PW1700000000ABCD|100.00|Pathwise 7-Year Scholar Pass|Aarav|aarav@example.com|student-123||||||||||eCwWELxi`
    )
    .digest('hex');

  assert.equal(computePayURequestHash(params, salt), expected);
});

test('verifyPayUResponseHash validates genuine PayU callbacks and rejects tampered status or amount', () => {
  const salt = 'test-merchant-salt';
  const base = {
    key: 'merchantKey',
    txnid: 'PW9999999999',
    amount: PAYU_AMOUNT_STR,
    productinfo: PAYU_PRODUCT_INFO,
    firstname: 'Ananya',
    email: 'ananya@example.com',
    udf1: 'uid-42',
    status: 'success',
  };

  const validHash = computePayUResponseHash(base, salt);
  assert.equal(verifyPayUResponseHash({ ...base, receivedHash: validHash }, salt), true);

  // Tampered amount must fail
  assert.equal(
    verifyPayUResponseHash({ ...base, amount: '1.00', receivedHash: validHash }, salt),
    false
  );

  // Tampered status must fail
  assert.equal(
    verifyPayUResponseHash({ ...base, status: 'failure', receivedHash: validHash }, salt),
    false
  );

  // Additional charges variant
  const withChargesHash = computePayUResponseHash({ ...base, additionalCharges: '2.00' }, salt);
  assert.equal(
    verifyPayUResponseHash(
      { ...base, additionalCharges: '2.00', receivedHash: withChargesHash },
      salt
    ),
    true
  );
  assert.equal(
    verifyPayUResponseHash(
      { ...base, additionalCharges: '5.00', receivedHash: withChargesHash },
      salt
    ),
    false
  );
});

test('getPayUActionUrl switches cleanly between PayU test and live endpoints', () => {
  assert.equal(getPayUActionUrl('test'), PAYU_TEST_ACTION_URL);
  assert.equal(getPayUActionUrl(''), PAYU_TEST_ACTION_URL);
  assert.equal(getPayUActionUrl('live'), PAYU_LIVE_ACTION_URL);
});
