import type { IntegrationProviderEnum } from '../value-objects/integration-provider.vo';

export interface SendMessageParams {
  connectionId: string;
  to: string;
  content: string;
  type?: string;
}

export interface SendMessageResult {
  externalMessageId: string;
}

export interface IMessagingGateway {
  getProvider(): IntegrationProviderEnum;
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
}
