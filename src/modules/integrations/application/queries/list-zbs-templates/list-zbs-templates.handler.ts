import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import {
  ZBS_TEMPLATE_REPOSITORY,
  type IZbsTemplateRepository,
} from '@/modules/integrations/domain/repositories/zbs-template.repository.interface';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import type { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';
import { ListZbsTemplatesQuery } from './list-zbs-templates.query';

@Injectable()
export class ListZbsTemplatesHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZBS_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IZbsTemplateRepository,
  ) {}

  async execute(query: ListZbsTemplatesQuery): Promise<ZbsTemplate[]> {
    const connection = await this.connectionRepo.findByMerchantAndProvider(
      query.merchantId,
      IntegrationProviderEnum.ZALO_OA,
    );
    if (!connection) {
      throw new NotFoundException('Merchant chưa liên kết Zalo OA.');
    }

    return this.templateRepo.findByConnection(connection.getUuid());
  }
}
