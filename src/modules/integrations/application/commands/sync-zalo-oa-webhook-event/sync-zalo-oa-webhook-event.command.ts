export class SyncZaloOaWebhookEventCommand {
  constructor(
    public readonly oaId: string,
    public readonly eventName: string,
    public readonly senderId: string,
    public readonly messageText: string,
    public readonly messageId: string | undefined,
    public readonly timestamp: number,
  ) {}
}
