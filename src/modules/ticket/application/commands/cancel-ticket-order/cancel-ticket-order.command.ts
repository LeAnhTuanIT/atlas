export class CancelTicketOrderCommand {
  constructor(
    public readonly ticketOrderId: string,
    public readonly finalStatus: 'CANCELLED' | 'EXPIRED',
  ) {}
}
