export class CustomerCreatedEvent {
  constructor(
    public readonly customerId: string,
    public readonly merchantId: string,
    public readonly fullName: string,
    public readonly phone?: string,
    public readonly email?: string,
    public readonly occurredOn: Date = new Date(),
  ) {}
}