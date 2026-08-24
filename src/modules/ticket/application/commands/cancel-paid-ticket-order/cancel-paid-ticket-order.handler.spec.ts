import { CancelPaidTicketOrderHandler } from './cancel-paid-ticket-order.handler';
import { CancelPaidTicketOrderCommand } from './cancel-paid-ticket-order.command';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

function buildPaidOrder() {
  const order = TicketOrder.create({
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
  order.markAsPaid();
  return order;
}

describe('CancelPaidTicketOrderHandler', () => {
  const orderRepo = { findById: jest.fn(), save: jest.fn() } as any;
  const ticketRepo = { findByOrderId: jest.fn(), saveMany: jest.fn() } as any;
  const manager = { createQueryBuilder: jest.fn(), update: jest.fn() } as any;
  const dataSource = { transaction: jest.fn((cb: any) => cb(manager)) } as any;
  const handler = new CancelPaidTicketOrderHandler(orderRepo, ticketRepo, dataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation((cb: any) => cb(manager));
    manager.update.mockResolvedValue({ affected: 1 });
    manager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    });
  });

  it('huỷ đơn PAID: chốt PAID->CANCELLED bằng conditional update, huỷ tất cả vé + cộng lại quota thật cho từng zone', async () => {
    const order = buildPaidOrder();
    orderRepo.findById.mockResolvedValueOnce(order);
    ticketRepo.findByOrderId.mockResolvedValueOnce([]);

    await handler.execute(new CancelPaidTicketOrderCommand(order.id));

    expect(order.getStatus()).toBe('CANCELLED');
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { uuid: order.id, status: 'PAID' },
      { status: 'CANCELLED' },
    );
    expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('ném lỗi khi order chưa PAID', async () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [
        { ticketProductId: 'p', ticketSessionId: 's', zoneId: 'z', quantity: 1, unitPrice: 1000 },
      ],
    });
    orderRepo.findById.mockResolvedValueOnce(order);

    await expect(handler.execute(new CancelPaidTicketOrderCommand(order.id))).rejects.toThrow(
      'Chỉ có thể huỷ đơn đã PAID bằng phương thức này',
    );
  });

  it('order thuộc merchant khác cmd.merchantId -> ném 404 (không tiết lộ tồn tại)', async () => {
    const order = buildPaidOrder();
    orderRepo.findById.mockResolvedValueOnce(order);

    await expect(
      handler.execute(new CancelPaidTicketOrderCommand(order.id, 'merchant-khac')),
    ).rejects.toThrow('Không tìm thấy đơn vé');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('conditional update báo affected=0 (đã bị huỷ/hoàn tiền bởi lệnh gọi đồng thời khác) -> không cộng lại quota/huỷ vé', async () => {
    const order = buildPaidOrder();
    orderRepo.findById.mockResolvedValueOnce(order);
    ticketRepo.findByOrderId.mockResolvedValueOnce([{ id: 't1' }]);
    manager.update.mockResolvedValue({ affected: 0 });

    await handler.execute(new CancelPaidTicketOrderCommand(order.id));

    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledTimes(1);
  });
});
