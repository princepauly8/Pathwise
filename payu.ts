import crypto from 'crypto';

export const PAYU_PLAN_ID = 'scholar_7yr_200inr' as const;
export const PAYU_AMOUNT_INR = 200 as const;
export const PAYU_AMOUNT_STR = '200.00' as const;
export const PAYU_CURRENCY = 'INR' as const;
export const PAYU_DURATION_YEARS = 7 as const;
export const PAYU_PRODUCT_INFO = 'Pathwise 7-Year Scholar Pass' as const;

export const PAYU_TEST_ACTION_URL = 'https://test.payu.in/_payment';
export const PAYU_LIVE_ACTION_URL = 'https://secure.payu.in/_payment';

export interface PayUHashParams {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
}

export interface PayUCallbackVerifyParams extends PayUHashParams {
  status: string;
  receivedHash: string;
  additionalCharges?: string;
}

export function safeHexEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a.toLowerCase(), 'utf8'), Buffer.from(b.toLowerCase(), 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Official PayU India request SHA-512 hash:
 * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
export function computePayURequestHash(params: PayUHashParams, salt: string): string {
  const hashSequence = [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 ?? '',
    params.udf2 ?? '',
    params.udf3 ?? '',
    params.udf4 ?? '',
    params.udf5 ?? '',
    '',
    '',
    '',
    '',
    '',
    salt,
  ].join('|');

  return crypto.createHash('sha512').update(hashSequence).digest('hex');
}

/**
 * Official PayU India reverse SHA-512 hash verification for surl/furl POST callbacks:
 * sha512([additionalCharges|]SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
export function computePayUResponseHash(
  params: Omit<PayUCallbackVerifyParams, 'receivedHash'>,
  salt: string
): string {
  const baseParts = [
    salt,
    params.status,
    '',
    '',
    '',
    '',
    '',
    params.udf5 ?? '',
    params.udf4 ?? '',
    params.udf3 ?? '',
    params.udf2 ?? '',
    params.udf1 ?? '',
    params.email,
    params.firstname,
    params.productinfo,
    params.amount,
    params.txnid,
    params.key,
  ];

  const sequence = params.additionalCharges?.trim()
    ? `${params.additionalCharges.trim()}|${baseParts.join('|')}`
    : baseParts.join('|');

  return crypto.createHash('sha512').update(sequence).digest('hex');
}

export function verifyPayUResponseHash(params: PayUCallbackVerifyParams, salt: string): boolean {
  const expected = computePayUResponseHash(params, salt);
  return safeHexEqual(params.receivedHash, expected);
}

export function getPayUActionUrl(envRaw?: string): string {
  return (envRaw ?? '').trim().toLowerCase() === 'live'
    ? PAYU_LIVE_ACTION_URL
    : PAYU_TEST_ACTION_URL;
}
