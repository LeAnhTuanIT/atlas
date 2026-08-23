export class GetZbsTemplateQuery {
  constructor(
    public readonly merchantId: string,
    public readonly templateUuid: string,
  ) {}
}
