export class PublishZbsTemplateCommand {
  constructor(
    public readonly merchantId: string,
    public readonly templateUuid: string,
  ) {}
}
