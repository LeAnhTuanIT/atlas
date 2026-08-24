import { Ticket } from '@/modules/ticket/domain/models/ticket.aggregate';
import { TicketStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrmEntity } from '../typeorm/entities/ticket.orm-entity';

export class TicketMapper {
  static toDomain(orm: TicketOrmEntity): Ticket {
    return new Ticket(
      orm.uuid,
      orm.code,
      orm.ticketOrderId,
      orm.ticketProductId,
      orm.ticketSessionId,
      orm.zoneId,
      orm.status as TicketStatusEnum,
      orm.remainingUses,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: Ticket): TicketOrmEntity {
    const orm = new TicketOrmEntity();
    orm.uuid = domain.id;
    orm.code = domain.getCode();
    orm.ticketOrderId = domain.getTicketOrderId();
    orm.ticketProductId = domain.getTicketProductId();
    orm.ticketSessionId = domain.getTicketSessionId();
    orm.zoneId = domain.getZoneId();
    orm.status = domain.getStatus();
    orm.remainingUses = domain.getRemainingUses();
    return orm;
  }
}
