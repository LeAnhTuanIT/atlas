import * as crypto from 'crypto';
import { verifyZbsTemplateWebhookSignature } from './verify-zbs-template-webhook-signature';

describe('verifyZbsTemplateWebhookSignature', () => {
  const secretKey = 'secret-key';
  const body = {
    event_name: 'change_template_status',
    oa_id: '23528683620520284',
    app_id: '26502567361042074',
    template_id: '123456',
    status: { prev_status: 'PENDING_REVIEW', new_status: 'REJECT' },
    reason: 'Mẫu tin bị lặp',
    timestamp: '1724921480327',
  };

  function computeMac(rawBody: Record<string, any>): string {
    return crypto
      .createHash('sha256')
      .update(
        `${rawBody.app_id}${JSON.stringify(rawBody)}${rawBody.timestamp}${secretKey}`,
      )
      .digest('hex');
  }

  it('trả true khi mac khớp', () => {
    const mac = computeMac(body);
    expect(
      verifyZbsTemplateWebhookSignature(body, mac, secretKey),
    ).toBe(true);
  });

  it('trả false khi mac không khớp (body bị sửa)', () => {
    const mac = computeMac(body);
    const tampered = { ...body, template_id: '999999' };
    expect(
      verifyZbsTemplateWebhookSignature(tampered, mac, secretKey),
    ).toBe(false);
  });

  it('trả false khi thiếu header signature', () => {
    expect(
      verifyZbsTemplateWebhookSignature(body, undefined, secretKey),
    ).toBe(false);
  });

  it('trả false khi body thiếu app_id hoặc timestamp', () => {
    const { app_id, ...rest } = body;
    expect(
      verifyZbsTemplateWebhookSignature(rest, 'bat-ky-mac-nao', secretKey),
    ).toBe(false);
  });
});
