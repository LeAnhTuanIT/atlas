// src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler.spec.ts
import { ConfirmTicketOrderPaymentHandler } from './confirm-ticket-order-payment.handler';
import { ConfirmTicketOrderPaymentCommand } from './confirm-ticket-order-payment.command';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

function buildOrder() {
  return TicketOrder.create({
    merchantId: 'merchant-1',
    channel: TicketOrderChannelEnum.ONLINE,
    buyerId: 'customer-1',
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

describe('ConfirmTicketOrderPaymentHandler', () => {
  const orderRepo = { findById: jest.fn() } as any;
  const ticketRepo = { findByOrderId: jest.fn() } as any;
  const manager = {
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as any;
  const dataSource = { transaction: jest.fn((cb: any) => cb(manager)) } as any;
  const handler = new ConfirmTicketOrderPaymentHandler(orderRepo, ticketRepo, dataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation((cb: any) => cb(manager));
  });

  it('trả về vé đã có sẵn (idempotent) nếu order đã PAID, không mở transaction quota', async () => {
    const order = buildOrder();
    order.markAsPaid();
    orderRepo.findById.mockResolvedValueOnce(order);
    ticketRepo.findByOrderId.mockResolvedValueOnce([{ getCode: () => 'TKT-ABC' }]);

    const result = await handler.execute(new ConfirmTicketOrderPaymentCommand(order.id));

    expect(result.tickets).toEqual([{ code: 'TKT-ABC' }]);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('ném lỗi 404 khi order không tồn tại', async () => {
    orderRepo.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new ConfirmTicketOrderPaymentCommand('khong-ton-tai')),
    ).rejects.toThrow('Không tìm thấy đơn vé');
  });

  it('ném lỗi 400 khi order không ở trạng thái PENDING (vd đã bị huỷ)', async () => {
    const order = buildOrder();
    order.markAsCancelled();
    orderRepo.findById.mockResolvedValueOnce(order);

    await expect(handler.execute(new ConfirmTicketOrderPaymentCommand(order.id))).rejects.toThrow(
      'Đơn vé không ở trạng thái chờ thanh toán',
    );
  });

  it('order PENDING hợp lệ: trừ quota qua queryBuilder, issue đúng số vé bằng tổng quantity, chuyển order sang PAID', async () => {
    const order = buildOrder(); // 1 dòng, quantity = 2
    orderRepo.findById.mockResolvedValueOnce(order);

    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    manager.createQueryBuilder.mockReturnValue(qb);
    manager.save = jest.fn().mockResolvedValue(undefined);
    manager.update = jest.fn().mockResolvedValue(undefined);

    const result = await handler.execute(new ConfirmTicketOrderPaymentCommand(order.id));

    expect(result.tickets).toHaveLength(2);
    expect(order.getStatus()).toBe('PAID');
    expect(qb.where).toHaveBeenCalledWith('uuid = :zoneId AND quota >= :qty', {
      zoneId: 'zone-1',
      qty: 2,
    });
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { uuid: order.id },
      { status: 'PAID' },
    );
  });

  it('ném ConflictException nếu queryBuilder báo affected=0 (hết quota tại thời điểm xác nhận)', async () => {
    const order = buildOrder();
    orderRepo.findById.mockResolvedValueOnce(order);

    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    manager.createQueryBuilder.mockReturnValue(qb);

    await expect(handler.execute(new ConfirmTicketOrderPaymentCommand(order.id))).rejects.toThrow(
      'Không đủ vé còn lại',
    );
  });
});
