export class ListZaloOaMessagesQuery {
  constructor(
    public readonly merchantId: string,
    public readonly cursor?: string,
    public readonly limit?: number,
  ) {}
}
