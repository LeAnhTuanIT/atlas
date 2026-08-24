export class PublishTicketProductCommand {
  constructor(
    public readonly merchantId: string,
    public readonly ticketProductId: string,
  ) {}
}
