export class CancelPaidTicketOrderCommand {
  constructor(
    public readonly ticketOrderId: string,
    public readonly merchantId?: string,
  ) {}
}
