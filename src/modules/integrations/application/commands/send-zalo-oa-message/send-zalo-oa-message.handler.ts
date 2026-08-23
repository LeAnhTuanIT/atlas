import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import {
  ZALO_OA_MESSAGE_REPOSITORY,
  type IZaloOaMessageRepository,
} from '@/modules/integrations/domain/repositories/zalo-oa-message.repository.interface';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import {
  ZaloOaMessage,
  ZaloOaMessageDirectionEnum,
} from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { IntegrationGatewayFactory } from '@/modules/integrations/infrastructure/gateways/integration-gateway.factory';
import { SendZaloOaMessageCommand } from './send-zalo-oa-message.command';

@Injectable()
export class SendZaloOaMessageHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZALO_OA_MESSAGE_REPOSITORY)
    private readonly messageRepo: IZaloOaMessageRepository,
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
    const result = await gateway.sendMessage({
      connectionId: connection.getUuid(),
      to: cmd.to,
      content: cmd.content,
      type: cmd.type,
    });

    const message = ZaloOaMessage.create({
      connectionId: connection.getUuid(),
      direction: ZaloOaMessageDirectionEnum.OUT,
      zaloUserId: cmd.to,
      content: cmd.content,
      messageType: cmd.type || 'text',
      externalMessageId: result.externalMessageId,
      sentAt: new Date(),
    });
    await this.messageRepo.save(message);

    return result;
  }
}
