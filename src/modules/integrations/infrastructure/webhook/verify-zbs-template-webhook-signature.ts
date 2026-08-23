import * as crypto from 'crypto';

/**
 * Xác thực header X-ZEvent-Signature theo tài liệu Zalo OA Webhook:
 * mac = SHA256(appId + data + timeStamp + OAsecretKey), với `data` là
 * chuỗi JSON nguyên vẹn của body trả về (không bao gồm chính mac, vì mac
 * được gửi ở header, không nằm trong body).
 */
export function verifyZbsTemplateWebhookSignature(
  rawBody: Record<string, any>,
  signature: string | undefined,
  secretKey: string,
): boolean {
  if (!signature) {
    return false;
  }

  const appId = rawBody?.app_id;
  const timestamp = rawBody?.timestamp;
  if (!appId || !timestamp) {
    return false;
  }

  const calculated = crypto
    .createHash('sha256')
    .update(`${appId}${JSON.stringify(rawBody)}${timestamp}${secretKey}`)
    .digest('hex');

  return calculated === signature;
}
