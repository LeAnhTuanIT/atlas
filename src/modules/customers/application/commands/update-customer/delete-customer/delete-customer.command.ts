export class DeleteCustomerCommand {
  constructor(
    public readonly merchantId: string,
    public readonly id: string,
  ) {}
}