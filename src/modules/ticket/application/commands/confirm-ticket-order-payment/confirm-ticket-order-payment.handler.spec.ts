// src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler.spec.ts
import { ConfirmTicketOrderPaymentHandler } from './confirm-ticket-order-payment.handler';
import { ConfirmTicketOrderPaymentCommand } from './confirm-ticket-order-payment.command';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import {
  TicketOrderChannelEnum,
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

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

function buildUnlimitedProduct() {
  return TicketProduct.create({
    merchantId: 'merchant-1',
    name: 'Vé khu vui chơi',
    priceAmount: 100000,
    priceCurrency: 'VND',
    validityType: TicketValidityTypeEnum.DAY_PASS,
    usageRule: { type: TicketUsageTypeEnum.UNLIMITED_USE },
    zones: [{ name: 'DEFAULT', quota: 100 }],
    sessions: [{ startAt: new Date('2026-01-01T00:00:00Z'), endAt: new Date('2099-01-01T23:59:59Z') }],
  });
}

describe('ConfirmTicketOrderPaymentHandler', () => {
  const orderRepo = { findById: jest.fn() } as any;
  const ticketRepo = { findByOrderId: jest.fn() } as any;
  const productRepo = { findById: jest.fn() } as any;
  const manager = {
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn(),
    update: jest.fn(),
  } as any;
  const dataSource = { transaction: jest.fn((cb: any) => cb(manager)) } as any;
  const handler = new ConfirmTicketOrderPaymentHandler(orderRepo, ticketRepo, productRepo, dataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation((cb: any) => cb(manager));
    productRepo.findById.mockResolvedValue(buildUnlimitedProduct());
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

  it('order PENDING hợp lệ: chốt PENDING->PAID bằng conditional update, trừ quota qua queryBuilder, issue đúng số vé bằng tổng quantity', async () => {
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
    manager.update.mockResolvedValue({ affected: 1 });

    const result = await handler.execute(new ConfirmTicketOrderPaymentCommand(order.id));

    expect(result.tickets).toHaveLength(2);
    expect(qb.where).toHaveBeenCalledWith('uuid = :zoneId AND quota >= :qty', {
      zoneId: 'zone-1',
      qty: 2,
    });
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { uuid: order.id, status: 'PENDING' },
      { status: 'PAID' },
    );
  });

  it('order thuộc merchant khác cmd.merchantId -> ném 404 (không tiết lộ tồn tại)', async () => {
    const order = buildOrder();
    orderRepo.findById.mockResolvedValueOnce(order);

    await expect(
      handler.execute(new ConfirmTicketOrderPaymentCommand(order.id, 'merchant-khac')),
    ).rejects.toThrow('Không tìm thấy đơn vé');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('issue vé với remainingUses lấy từ usageRule LIMITED_USE của sản phẩm', async () => {
    const order = buildOrder();
    orderRepo.findById.mockResolvedValueOnce(order);

    const limitedProduct = TicketProduct.create({
      merchantId: 'merchant-1',
      name: 'Vé nhiều lượt',
      priceAmount: 100000,
      priceCurrency: 'VND',
      validityType: TicketValidityTypeEnum.DAY_PASS,
      usageRule: { type: TicketUsageTypeEnum.LIMITED_USE, maxUses: 5 },
      zones: [{ name: 'DEFAULT', quota: 100 }],
      sessions: [{ startAt: new Date('2026-01-01T00:00:00Z'), endAt: new Date('2099-01-01T23:59:59Z') }],
    });
    productRepo.findById.mockResolvedValue(limitedProduct);

    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    manager.createQueryBuilder.mockReturnValue(qb);
    manager.save = jest.fn().mockResolvedValue(undefined);
    manager.update.mockResolvedValue({ affected: 1 });

    let savedTickets: any[] = [];
    manager.save.mockImplementation((_entity: any, tickets: any[]) => {
      savedTickets = tickets;
      return Promise.resolve(undefined);
    });

    await handler.execute(new ConfirmTicketOrderPaymentCommand(order.id));

    expect(savedTickets).toHaveLength(2);
    expect(savedTickets.every((t) => t.remainingUses === 5)).toBe(true);
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
    manager.update.mockResolvedValue({ affected: 1 });

    await expect(handler.execute(new ConfirmTicketOrderPaymentCommand(order.id))).rejects.toThrow(
      'Không đủ vé còn lại',
    );
  });

  it('conditional update báo affected=0 (bị lệnh gọi đồng thời khác chốt trước) -> không trừ quota/issue vé, trả về vé đã có sẵn', async () => {
    const order = buildOrder();
    orderRepo.findById.mockResolvedValueOnce(order);
    manager.update.mockResolvedValue({ affected: 0 });
    ticketRepo.findByOrderId.mockResolvedValueOnce([{ getCode: () => 'TKT-XYZ' }]);

    const result = await handler.execute(new ConfirmTicketOrderPaymentCommand(order.id));

    expect(result.tickets).toEqual([{ code: 'TKT-XYZ' }]);
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
  });
});
