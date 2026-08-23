export class UpdateZbsTemplateStatusFromWebhookCommand {
  constructor(
    public readonly oaId: string,
    public readonly templateId: string,
    public readonly newStatus: string,
    public readonly reason: string | undefined,
  ) {}
}
