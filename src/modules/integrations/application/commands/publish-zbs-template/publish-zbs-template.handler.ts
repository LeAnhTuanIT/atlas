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
import { ZaloOaGateway } from '@/modules/integrations/infrastructure/gateways/zalo-oa.gateway';
import { PublishZbsTemplateCommand } from './publish-zbs-template.command';

@Injectable()
export class PublishZbsTemplateHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZBS_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IZbsTemplateRepository,
    private readonly zaloOaGateway: ZaloOaGateway,
  ) {}

  async execute(cmd: PublishZbsTemplateCommand): Promise<ZbsTemplate> {
    const connection = await this.connectionRepo.findByMerchantAndProvider(
      cmd.merchantId,
      IntegrationProviderEnum.ZALO_OA,
    );
    if (!connection) {
      throw new NotFoundException('Merchant chưa liên kết Zalo OA.');
    }

    const template = await this.templateRepo.findByUuidAndConnection(
      cmd.templateUuid,
      connection.getUuid(),
    );
    if (!template) {
      throw new NotFoundException('Không tìm thấy template.');
    }

    const result = await this.zaloOaGateway.publishTemplate(
      connection.getUuid(),
      template,
    );
    template.markPublished(result);
    await this.templateRepo.save(template);

    return template;
  }
}
