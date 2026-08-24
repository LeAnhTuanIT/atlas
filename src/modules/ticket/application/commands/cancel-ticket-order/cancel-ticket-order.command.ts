export class CancelTicketOrderCommand {
  constructor(
    public readonly ticketOrderId: string,
    public readonly finalStatus: 'CANCELLED' | 'EXPIRED',
    // Không có giá trị khi gọi từ webhook cổng thanh toán hoặc cron expiry (không có ngữ cảnh
    // merchant, xác thực bằng chữ ký webhook / hệ thống thay vì merchant JWT).
    public readonly merchantId?: string,
  ) {}
}
