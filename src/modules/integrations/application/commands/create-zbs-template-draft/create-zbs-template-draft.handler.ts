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
import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';
import { CreateZbsTemplateDraftCommand } from './create-zbs-template-draft.command';

@Injectable()
export class CreateZbsTemplateDraftHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZBS_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IZbsTemplateRepository,
  ) {}

  async execute(cmd: CreateZbsTemplateDraftCommand): Promise<ZbsTemplate> {
    const connection = await this.connectionRepo.findByMerchantAndProvider(
      cmd.merchantId,
      IntegrationProviderEnum.ZALO_OA,
    );
    if (!connection) {
      throw new NotFoundException('Merchant chưa liên kết Zalo OA.');
    }

    const template = ZbsTemplate.createDraft({
      connectionId: connection.getUuid(),
      templateName: cmd.templateName,
      templateType: cmd.templateType,
      tag: cmd.tag,
      layout: cmd.layout,
      params: cmd.params,
      note: cmd.note,
      trackingId: cmd.trackingId,
    });

    await this.templateRepo.save(template);
    return template;
  }
}
