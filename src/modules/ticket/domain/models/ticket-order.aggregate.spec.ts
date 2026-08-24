import { TicketOrder } from './ticket-order.aggregate';
import { TicketOrderChannelEnum, TicketOrderStatusEnum } from '../value-objects/ticket-enums.vo';

function buildLine(overrides: Partial<{ quantity: number }> = {}) {
  return {
    ticketProductId: 'product-1',
    ticketSessionId: 'session-1',
    zoneId: 'zone-1',
    quantity: overrides.quantity ?? 2,
    unitPrice: 100000,
  };
}

describe('TicketOrder', () => {
  it('tạo đơn ONLINE hợp lệ ở trạng thái PENDING', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.ONLINE,
      buyerId: 'customer-1',
      lines: [buildLine()],
    });

    expect(order.getStatus()).toBe(TicketOrderStatusEnum.PENDING);
    expect(order.getChannel()).toBe(TicketOrderChannelEnum.ONLINE);
    expect(order.getTotalAmount()).toBe(200000);
    expect(order.isPending()).toBe(true);
  });

  it('ném lỗi khi đơn ONLINE không có buyerId', () => {
    expect(() =>
      TicketOrder.create({
        merchantId: 'merchant-1',
        channel: TicketOrderChannelEnum.ONLINE,
        lines: [buildLine()],
      }),
    ).toThrow('Đơn vé online phải có buyerId');
  });

  it('tạo đơn COUNTER hợp lệ không cần buyerId', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    expect(order.getBuyerId()).toBeUndefined();
  });

  it('ném lỗi khi không có dòng vé nào', () => {
    expect(() =>
      TicketOrder.create({
        merchantId: 'merchant-1',
        channel: TicketOrderChannelEnum.COUNTER,
        lines: [],
      }),
    ).toThrow('Đơn vé phải có ít nhất 1 dòng vé');
  });

  it('ném lỗi khi số lượng dòng vé <= 0', () => {
    expect(() =>
      TicketOrder.create({
        merchantId: 'merchant-1',
        channel: TicketOrderChannelEnum.COUNTER,
        lines: [buildLine({ quantity: 0 })],
      }),
    ).toThrow('Số lượng vé phải lớn hơn 0');
  });

  it('markAsPaid() chuyển PENDING -> PAID, idempotent nếu gọi lại', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    order.markAsPaid();
    expect(order.getStatus()).toBe(TicketOrderStatusEnum.PAID);
    expect(() => order.markAsPaid()).not.toThrow();
  });

  it('markAsCancelled() ném lỗi nếu đơn đã PAID', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    order.markAsPaid();
    expect(() => order.markAsCancelled()).toThrow(
      'Không thể huỷ đơn đã thanh toán qua markAsCancelled, dùng luồng hoàn tiền riêng',
    );
  });

  it('markAsExpired() chỉ có hiệu lực khi đang PENDING', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    order.markAsPaid();
    order.markAsExpired();
    expect(order.getStatus()).toBe(TicketOrderStatusEnum.PAID);
  });

  it('cancelPaidOrder() chuyển PAID -> CANCELLED, ném lỗi nếu chưa PAID', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    expect(() => order.cancelPaidOrder()).toThrow(
      'Chỉ có thể huỷ đơn đã PAID bằng phương thức này',
    );
    order.markAsPaid();
    order.cancelPaidOrder();
    expect(order.getStatus()).toBe(TicketOrderStatusEnum.CANCELLED);
  });

  it('attachPaymentOrderCode() lưu mã liên kết gateway thanh toán', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.ONLINE,
      buyerId: 'customer-1',
      lines: [buildLine()],
    });
    order.attachPaymentOrderCode(order.id);
    expect(order.getPaymentOrderCode()).toBe(order.id);
  });
});
