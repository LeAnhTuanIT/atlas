export class UnifiedLoginCommand {
  constructor(
    public readonly identifier: string, // SĐT hoặc Email
    public readonly password?: string,
    public readonly merchantId?: string,
  ) {}
}
