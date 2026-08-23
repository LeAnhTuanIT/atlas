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
import { ZaloOaGateway } from '@/modules/integrations/infrastructure/gateways/zalo-oa.gateway';
import { SyncZbsTemplatesCommand } from './sync-zbs-templates.command';

@Injectable()
export class SyncZbsTemplatesHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZBS_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IZbsTemplateRepository,
    private readonly zaloOaGateway: ZaloOaGateway,
  ) {}

  async execute(cmd: SyncZbsTemplatesCommand): Promise<ZbsTemplate[]> {
    const connection = await this.connectionRepo.findByMerchantAndProvider(
      cmd.merchantId,
      IntegrationProviderEnum.ZALO_OA,
    );
    if (!connection) {
      throw new NotFoundException('Merchant chưa liên kết Zalo OA.');
    }

    const items = await this.zaloOaGateway.listTemplates(connection.getUuid());
    const syncedAt = new Date();
    const templates: ZbsTemplate[] = [];

    for (const item of items) {
      const existing = await this.templateRepo.findByConnectionAndTemplateId(
        connection.getUuid(),
        item.templateId,
      );

      if (existing) {
        existing.updateFromSync({
          templateName: item.templateName,
          status: item.status,
          syncedAt,
        });
        await this.templateRepo.save(existing);
        templates.push(existing);
      } else {
        const created = ZbsTemplate.create({
          connectionId: connection.getUuid(),
          templateId: item.templateId,
          templateName: item.templateName,
          status: item.status,
          syncedAt,
        });
        await this.templateRepo.save(created);
        templates.push(created);
      }
    }

    return templates;
  }
}
