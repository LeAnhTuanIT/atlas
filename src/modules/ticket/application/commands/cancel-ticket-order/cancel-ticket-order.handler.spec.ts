import { CancelTicketOrderHandler } from './cancel-ticket-order.handler';
import { CancelTicketOrderCommand } from './cancel-ticket-order.command';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

function buildOrder() {
  return TicketOrder.create({
    merchantId: 'merchant-1',
    channel: TicketOrderChannelEnum.COUNTER,
    lines: [
      {
        ticketProductId: 'product-1',
        ticketSessionId: 'session-1',
        zoneId: 'zone-1',
        quantity: 2,
        unitPrice: 100000,
      },
    ],
  });
}

describe('CancelTicketOrderHandler', () => {
  const orderRepo = { findById: jest.fn(), save: jest.fn() } as any;
  const availabilityService = { release: jest.fn() } as any;
  const handler = new CancelTicketOrderHandler(orderRepo, availabilityService);

  beforeEach(() => jest.clearAllMocks());

  it('huỷ đơn PENDING, nhả lại quota Redis cho từng dòng', async () => {
    const order = buildOrder();
    orderRepo.findById.mockResolvedValueOnce(order);

    await handler.execute(new CancelTicketOrderCommand(order.id, 'CANCELLED'));

    expect(order.getStatus()).toBe('CANCELLED');
    expect(availabilityService.release).toHaveBeenCalledWith('session-1', 'zone-1', 2);
    expect(orderRepo.save).toHaveBeenCalledWith(order);
  });

  it('finalStatus=EXPIRED gọi markAsExpired thay vì markAsCancelled', async () => {
    const order = buildOrder();
    orderRepo.findById.mockResolvedValueOnce(order);

    await handler.execute(new CancelTicketOrderCommand(order.id, 'EXPIRED'));

    expect(order.getStatus()).toBe('EXPIRED');
  });

  it('ném lỗi 404 khi order không tồn tại', async () => {
    orderRepo.findById.mockResolvedValueOnce(null);

    await expect(handler.execute(new CancelTicketOrderCommand('x', 'CANCELLED'))).rejects.toThrow(
      'Không tìm thấy đơn vé',
    );
  });
});
