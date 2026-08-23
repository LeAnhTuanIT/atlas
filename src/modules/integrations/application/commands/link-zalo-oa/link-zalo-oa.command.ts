export class LinkZaloOaCommand {
  constructor(
    public readonly merchantId: string,
    public readonly code: string,
    public readonly oaId: string,
  ) {}
}
