export class CreateCustomerCommand {
  constructor(
    public readonly merchantId: string,
    public readonly fullName: string,
    public readonly phone?: string,
    public readonly email?: string,
    public readonly password?: string,
  ) {}
}
