import {
  ZaloOaMessage,
  ZaloOaMessageDirectionEnum,
} from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { ZaloOaMessageMapper } from './zalo-oa-message.mapper';

describe('ZaloOaMessageMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu', () => {
    const sentAt = new Date('2026-08-23T09:00:00Z');
    const domain = ZaloOaMessage.create({
      connectionId: 'conn-1',
      direction: ZaloOaMessageDirectionEnum.IN,
      zaloUserId: 'zalo-user-1',
      content: 'Xin chào',
      messageType: 'text',
      externalMessageId: 'msg-1',
      sentAt,
    });

    const orm = ZaloOaMessageMapper.toOrm(domain);
    orm.id = '10';

    const roundTripped = ZaloOaMessageMapper.toDomain(orm);
    expect(roundTripped.getConnectionId()).toBe('conn-1');
    expect(roundTripped.getDirection()).toBe(ZaloOaMessageDirectionEnum.IN);
    expect(roundTripped.getContent()).toBe('Xin chào');
    expect(roundTripped.getExternalMessageId()).toBe('msg-1');
    expect(roundTripped.getSentAt()).toEqual(sentAt);
  });
});
