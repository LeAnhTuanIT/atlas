import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrderMapper } from './ticket-order.mapper';

describe('TicketOrderMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu, bao gồm các dòng vé', () => {
    const domain = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.ONLINE,
      buyerId: 'customer-1',
      lines: [
        {
          ticketProductId: 'product-1',
          ticketSessionId: 'session-1',
          zoneId: 'zone-1',
          quantity: 3,
          unitPrice: 50000,
        },
      ],
    });
    domain.attachPaymentOrderCode(domain.id);

    const orm = TicketOrderMapper.toOrm(domain);
    orm.id = '1';
    orm.lines.forEach((l, i) => (l.id = String(i + 1)));

    expect(orm.uuid).toBe(domain.id);
    expect(orm.lines).toHaveLength(1);
    expect(orm.lines[0].quantity).toBe(3);
    expect(orm.paymentOrderCode).toBe(domain.id);

    const roundTripped = TicketOrderMapper.toDomain(orm);
    expect(roundTripped.id).toBe(domain.id);
    expect(roundTripped.getTotalAmount()).toBe(150000);
    expect(roundTripped.getStatus()).toBe(domain.getStatus());
    expect(roundTripped.getPaymentOrderCode()).toBe(domain.id);
  });
});
