import {
  ZaloOaMessage,
  ZaloOaMessageDirectionEnum,
} from './zalo-oa-message.entity';

describe('ZaloOaMessage', () => {
  it('create() khởi tạo đầy đủ field và sinh uuid', () => {
    const sentAt = new Date('2026-08-23T10:00:00Z');
    const msg = ZaloOaMessage.create({
      connectionId: 'conn-1',
      direction: ZaloOaMessageDirectionEnum.IN,
      zaloUserId: 'zalo-user-1',
      content: 'Xin chào',
      messageType: 'text',
      externalMessageId: 'msg-abc',
      sentAt,
    });

    expect(msg.getConnectionId()).toBe('conn-1');
    expect(msg.getDirection()).toBe(ZaloOaMessageDirectionEnum.IN);
    expect(msg.getZaloUserId()).toBe('zalo-user-1');
    expect(msg.getContent()).toBe('Xin chào');
    expect(msg.getMessageType()).toBe('text');
    expect(msg.getExternalMessageId()).toBe('msg-abc');
    expect(msg.getSentAt()).toEqual(sentAt);
    expect(msg.getUuid()).toEqual(expect.any(String));
  });

  it('create() cho phép externalMessageId undefined (tin OUT tự gửi, chưa có id trả về)', () => {
    const msg = ZaloOaMessage.create({
      connectionId: 'conn-1',
      direction: ZaloOaMessageDirectionEnum.OUT,
      zaloUserId: 'zalo-user-1',
      content: 'Cảm ơn bạn',
      messageType: 'text',
      sentAt: new Date(),
    });

    expect(msg.getExternalMessageId()).toBeUndefined();
  });
});
