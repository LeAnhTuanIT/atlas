export class ImportCustomersCommand {
  constructor(
    public readonly merchantId: string,
    public readonly fileBuffer: Buffer,
    public readonly fileName: string,
  ) {}
}