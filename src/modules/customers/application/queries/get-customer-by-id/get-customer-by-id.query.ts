export class GetCustomerByIdQuery {
  constructor(
    public readonly merchantId: string,
    public readonly id: string,
  ) {}
}