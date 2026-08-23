import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationGatewayFactory } from '@/modules/integrations/infrastructure/gateways/integration-gateway.factory';
import { SendZaloOaMessageCommand } from './send-zalo-oa-message.command';

@Injectable()
export class SendZaloOaMessageHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    private readonly gatewayFactory: IntegrationGatewayFactory,
  ) {}

  async execute(
    cmd: SendZaloOaMessageCommand,
  ): Promise<{ externalMessageId: string }> {
    const connection = await this.connectionRepo.findByMerchantAndProvider(
      cmd.merchantId,
      IntegrationProviderEnum.ZALO_OA,
    );
    if (!connection) {
      throw new NotFoundException(
        'Merchant chưa liên kết Zalo OA, vui lòng liên kết trước khi gửi tin.',
      );
    }

    const gateway = this.gatewayFactory.getMessagingGateway(
      IntegrationProviderEnum.ZALO_OA,
    );
    return gateway.sendMessage({
      connectionId: connection.getUuid(),
      to: cmd.to,
      content: cmd.content,
      type: cmd.type,
    });
  }
}
