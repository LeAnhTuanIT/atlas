import { ZaloOaMessage } from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { ZaloOaMessageOrmEntity } from '../entities/zalo-oa-message.orm-entity';

export class ZaloOaMessageMapper {
  static toDomain(orm: ZaloOaMessageOrmEntity): ZaloOaMessage {
    return new ZaloOaMessage(
      orm.uuid,
      orm.connectionId,
      orm.direction,
      orm.zaloUserId,
      orm.content,
      orm.messageType,
      orm.externalMessageId ?? undefined,
      orm.sentAt,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: ZaloOaMessage): ZaloOaMessageOrmEntity {
    const orm = new ZaloOaMessageOrmEntity();
    orm.uuid = domain.getUuid();
    orm.connectionId = domain.getConnectionId();
    orm.direction = domain.getDirection();
    orm.zaloUserId = domain.getZaloUserId();
    orm.content = domain.getContent();
    orm.messageType = domain.getMessageType();
    orm.externalMessageId = domain.getExternalMessageId() ?? null;
    orm.sentAt = domain.getSentAt();
    return orm;
  }
}
