import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderLine } from '@/modules/ticket/domain/models/ticket-order-line.entity';
import {
  TicketOrderChannelEnum,
  TicketOrderStatusEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrderOrmEntity } from '../typeorm/entities/ticket-order.orm-entity';
import { TicketOrderLineOrmEntity } from '../typeorm/entities/ticket-order-line.orm-entity';

export class TicketOrderMapper {
  static toDomain(orm: TicketOrderOrmEntity): TicketOrder {
    return new TicketOrder(
      orm.uuid,
      orm.merchantId,
      orm.channel as TicketOrderChannelEnum,
      orm.buyerId ?? undefined,
      (orm.lines ?? []).map(
        (l) =>
          new TicketOrderLine({
            id: l.uuid,
            ticketProductId: l.ticketProductId,
            ticketSessionId: l.ticketSessionId,
            zoneId: l.zoneId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          }),
      ),
      orm.status as TicketOrderStatusEnum,
      orm.paymentOrderCode ?? undefined,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: TicketOrder): TicketOrderOrmEntity {
    const orm = new TicketOrderOrmEntity();
    orm.uuid = domain.id;
    orm.merchantId = domain.getMerchantId();
    orm.channel = domain.getChannel();
    orm.buyerId = domain.getBuyerId() ?? null;
    orm.status = domain.getStatus();
    orm.paymentOrderCode = domain.getPaymentOrderCode() ?? null;
    orm.lines = domain.getLines().map((l) => {
      const lineOrm = new TicketOrderLineOrmEntity();
      lineOrm.uuid = l.getId();
      lineOrm.ticketProductId = l.getTicketProductId();
      lineOrm.ticketSessionId = l.getTicketSessionId();
      lineOrm.zoneId = l.getZoneId();
      lineOrm.quantity = l.getQuantity();
      lineOrm.unitPrice = l.getUnitPrice();
      return lineOrm;
    });
    return orm;
  }
}
