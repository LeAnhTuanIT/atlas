export class SendZaloOaMessageCommand {
  constructor(
    public readonly merchantId: string,
    public readonly to: string,
    public readonly content: string,
    public readonly type?: string,
  ) {}
}
