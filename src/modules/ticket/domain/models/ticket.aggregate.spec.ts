import { Ticket } from './ticket.aggregate';
import { TicketStatusEnum } from '../value-objects/ticket-enums.vo';

describe('Ticket', () => {
  it('issue() tạo vé ISSUED với code duy nhất bắt đầu bằng TKT-', () => {
    const ticket = Ticket.issue({
      ticketOrderId: 'order-1',
      ticketProductId: 'product-1',
      ticketSessionId: 'session-1',
      zoneId: 'zone-1',
      remainingUses: null,
    });

    expect(ticket.getStatus()).toBe(TicketStatusEnum.ISSUED);
    expect(ticket.getCode()).toMatch(/^TKT-[A-Z0-9]{12}$/);
    expect(ticket.getRemainingUses()).toBeNull();
  });

  it('issue() hai lần cho ra hai code khác nhau', () => {
    const params = {
      ticketOrderId: 'order-1',
      ticketProductId: 'product-1',
      ticketSessionId: 'session-1',
      zoneId: 'zone-1',
      remainingUses: 5,
    };
    const a = Ticket.issue(params);
    const b = Ticket.issue(params);
    expect(a.getCode()).not.toBe(b.getCode());
    expect(a.getRemainingUses()).toBe(5);
  });

  it('cancel() chuyển ISSUED -> CANCELLED, idempotent nếu gọi lại', () => {
    const ticket = Ticket.issue({
      ticketOrderId: 'order-1',
      ticketProductId: 'product-1',
      ticketSessionId: 'session-1',
      zoneId: 'zone-1',
      remainingUses: null,
    });
    ticket.cancel();
    expect(ticket.getStatus()).toBe(TicketStatusEnum.CANCELLED);
    expect(() => ticket.cancel()).not.toThrow();
  });
});
