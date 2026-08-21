export class ExportCustomersQuery {
  constructor(
    public readonly merchantId: string,
    public readonly format: 'csv' | 'xlsx' = 'csv',
  ) {}
}