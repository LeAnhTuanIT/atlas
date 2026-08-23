import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import {
  ZALO_OA_MESSAGE_REPOSITORY,
  type IZaloOaMessageRepository,
  type ZaloOaMessagePage,
} from '@/modules/integrations/domain/repositories/zalo-oa-message.repository.interface';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { ListZaloOaMessagesQuery } from './list-zalo-oa-messages.query';

@Injectable()
export class ListZaloOaMessagesHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZALO_OA_MESSAGE_REPOSITORY)
    private readonly messageRepo: IZaloOaMessageRepository,
  ) {}

  async execute(query: ListZaloOaMessagesQuery): Promise<ZaloOaMessagePage> {
    const connection = await this.connectionRepo.findByMerchantAndProvider(
      query.merchantId,
      IntegrationProviderEnum.ZALO_OA,
    );
    if (!connection) {
      throw new NotFoundException('Merchant chưa liên kết Zalo OA.');
    }

    return this.messageRepo.findByConnection(connection.getUuid(), {
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
