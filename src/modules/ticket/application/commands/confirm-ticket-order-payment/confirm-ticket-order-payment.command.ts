export class ConfirmTicketOrderPaymentCommand {
  constructor(
    public readonly ticketOrderId: string,
    // Không có giá trị khi gọi từ webhook cổng thanh toán (không có ngữ cảnh merchant,
    // xác thực bằng chữ ký webhook thay vì merchant JWT).
    public readonly merchantId?: string,
  ) {}
}
