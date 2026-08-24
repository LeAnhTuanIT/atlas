import { CreateTicketOrderHandler } from './create-ticket-order.handler';
import { CreateTicketOrderCommand } from './create-ticket-order.command';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import {
  TicketOrderChannelEnum,
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { PaymentGatewayEnum } from '@/modules/payment/domain/value-objects/payment-status.vo';

describe('CreateTicketOrderHandler', () => {
  const productRepo = { findPublishedById: jest.fn() } as any;
  const orderRepo = { save: jest.fn() } as any;
  const availabilityService = { reserve: jest.fn(), release: jest.fn() } as any;
  const gateway = { createPaymentUrl: jest.fn() };
  const gatewayFactory = { get: jest.fn().mockReturnValue(gateway) } as any;
  const handler = new CreateTicketOrderHandler(
    productRepo,
    orderRepo,
    availabilityService,
    gatewayFactory,
  );

  function buildProduct() {
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

  beforeEach(() => jest.clearAllMocks());

  it('kênh ONLINE: giữ chỗ thành công -> tạo order PENDING + trả về paymentUrl', async () => {
    const product = buildProduct();
    productRepo.findPublishedById.mockResolvedValueOnce(product);
    availabilityService.reserve.mockResolvedValueOnce(true);
    gateway.createPaymentUrl.mockResolvedValueOnce({ paymentUrl: 'https://pay.example/abc' });

    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    const result = await handler.execute(
      new CreateTicketOrderCommand(
        'merchant-1',
        TicketOrderChannelEnum.ONLINE,
        'customer-1',
        [{ ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 2 }],
        PaymentGatewayEnum.PAYOS,
        'https://frontend.example/return',
      ),
    );

    expect(result.status).toBe('PENDING');
    expect(result.totalAmount).toBe(200000);
    expect(result.paymentUrl).toBe('https://pay.example/abc');
    expect(availabilityService.reserve).toHaveBeenCalledWith(sessionId, zoneId, 2, 100);
    expect(orderRepo.save).toHaveBeenCalled();
  });

  it('kênh COUNTER: không tạo payment link, order vẫn PENDING chờ merchant xác nhận thu tiền', async () => {
    const product = buildProduct();
    productRepo.findPublishedById.mockResolvedValueOnce(product);
    availabilityService.reserve.mockResolvedValueOnce(true);

    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    const result = await handler.execute(
      new CreateTicketOrderCommand(
        'merchant-1',
        TicketOrderChannelEnum.COUNTER,
        undefined,
        [{ ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 1 }],
      ),
    );

    expect(result.status).toBe('PENDING');
    expect(result.paymentUrl).toBeUndefined();
    expect(gatewayFactory.get).not.toHaveBeenCalled();
  });

  it('ném lỗi 409 khi hết quota (reserve trả về false)', async () => {
    const product = buildProduct();
    productRepo.findPublishedById.mockResolvedValueOnce(product);
    availabilityService.reserve.mockResolvedValueOnce(false);

    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    await expect(
      handler.execute(
        new CreateTicketOrderCommand(
          'merchant-1',
          TicketOrderChannelEnum.COUNTER,
          undefined,
          [{ ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 999 }],
        ),
      ),
    ).rejects.toThrow('Không đủ vé còn lại');

    expect(orderRepo.save).not.toHaveBeenCalled();
  });

  it('ném lỗi 404 khi loại vé chưa publish hoặc không tồn tại', async () => {
    productRepo.findPublishedById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(
        new CreateTicketOrderCommand('merchant-1', TicketOrderChannelEnum.COUNTER, undefined, [
          { ticketProductId: 'khong-ton-tai', ticketSessionId: 's', zoneId: 'z', quantity: 1 },
        ]),
      ),
    ).rejects.toThrow('Loại vé không khả dụng để bán');
  });

  it('giữ chỗ thành công 1 dòng nhưng dòng thứ 2 hết quota -> nhả lại dòng đã giữ và ném lỗi', async () => {
    const product = buildProduct();
    productRepo.findPublishedById.mockResolvedValue(product);
    availabilityService.reserve.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    await expect(
      handler.execute(
        new CreateTicketOrderCommand('merchant-1', TicketOrderChannelEnum.COUNTER, undefined, [
          { ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 1 },
          { ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 1 },
        ]),
      ),
    ).rejects.toThrow('Không đủ vé còn lại');

    expect(availabilityService.release).toHaveBeenCalledWith(sessionId, zoneId, 1);
    expect(orderRepo.save).not.toHaveBeenCalled();
  });

  it('kênh ONLINE: giữ chỗ thành công nhưng tạo payment link thất bại -> nhả lại các dòng đã giữ và ném lỗi', async () => {
    const product = buildProduct();
    productRepo.findPublishedById.mockResolvedValue(product);
    availabilityService.reserve.mockResolvedValueOnce(true).mockResolvedValueOnce(true);
    gateway.createPaymentUrl.mockRejectedValueOnce(new Error('Cổng thanh toán không phản hồi'));

    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    await expect(
      handler.execute(
        new CreateTicketOrderCommand(
          'merchant-1',
          TicketOrderChannelEnum.ONLINE,
          'customer-1',
          [
            { ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 1 },
            { ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 1 },
          ],
          PaymentGatewayEnum.PAYOS,
          'https://frontend.example/return',
        ),
      ),
    ).rejects.toThrow('Cổng thanh toán không phản hồi');

    expect(availabilityService.release).toHaveBeenCalledTimes(2);
    expect(availabilityService.release).toHaveBeenCalledWith(sessionId, zoneId, 1);
    expect(orderRepo.save).not.toHaveBeenCalled();
  });
});
