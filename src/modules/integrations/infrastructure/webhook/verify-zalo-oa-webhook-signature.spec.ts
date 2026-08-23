import * as crypto from 'crypto';
import { verifyZaloOaWebhookSignature } from './verify-zalo-oa-webhook-signature';

describe('verifyZaloOaWebhookSignature', () => {
  const secretKey = 'secret-key';

  it('trả true khi mac khớp', () => {
    const rest = { app_id: 'app-1', event_name: 'user_send_text' };
    const mac = crypto
      .createHmac('sha256', secretKey)
      .update(JSON.stringify(rest))
      .digest('hex');

    expect(verifyZaloOaWebhookSignature({ ...rest, mac }, secretKey)).toBe(
      true,
    );
  });

  it('trả false khi mac không khớp (payload bị sửa)', () => {
    const rest = { app_id: 'app-1', event_name: 'user_send_text' };
    const mac = crypto
      .createHmac('sha256', secretKey)
      .update(JSON.stringify(rest))
      .digest('hex');

    expect(
      verifyZaloOaWebhookSignature(
        { app_id: 'app-1-hacked', event_name: 'user_send_text', mac },
        secretKey,
      ),
    ).toBe(false);
  });

  it('trả false khi thiếu field mac', () => {
    expect(verifyZaloOaWebhookSignature({ app_id: 'app-1' }, secretKey)).toBe(
      false,
    );
  });
});
