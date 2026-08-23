export class DeleteZbsTemplateCommand {
  constructor(
    public readonly merchantId: string,
    public readonly templateUuid: string,
  ) {}
}
