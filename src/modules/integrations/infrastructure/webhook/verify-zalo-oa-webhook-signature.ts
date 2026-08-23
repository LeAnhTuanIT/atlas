import * as crypto from 'crypto';

export function verifyZaloOaWebhookSignature(
  rawBody: Record<string, any>,
  secretKey: string,
): boolean {
  const { mac, ...rest } = rawBody || {};
  if (!mac || typeof mac !== 'string') {
    return false;
  }

  const calculated = crypto
    .createHmac('sha256', secretKey)
    .update(JSON.stringify(rest))
    .digest('hex');

  return calculated === mac;
}
