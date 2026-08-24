import { Ticket } from '@/modules/ticket/domain/models/ticket.aggregate';
import { TicketStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketMapper } from './ticket.mapper';

describe('TicketMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu', () => {
    const domain = Ticket.issue({
      ticketOrderId: 'order-1',
      ticketProductId: 'product-1',
      ticketSessionId: 'session-1',
      zoneId: 'zone-1',
      remainingUses: 3,
    });

    const orm = TicketMapper.toOrm(domain);
    orm.id = '1';

    expect(orm.uuid).toBe(domain.id);
    expect(orm.code).toBe(domain.getCode());
    expect(orm.status).toBe(TicketStatusEnum.ISSUED);
    expect(orm.remainingUses).toBe(3);

    const roundTripped = TicketMapper.toDomain(orm);
    expect(roundTripped.id).toBe(domain.id);
    expect(roundTripped.getCode()).toBe(domain.getCode());
    expect(roundTripped.getRemainingUses()).toBe(3);
  });
});
