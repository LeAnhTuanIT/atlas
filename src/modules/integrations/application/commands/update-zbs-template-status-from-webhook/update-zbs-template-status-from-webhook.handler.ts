import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import {
  ZBS_TEMPLATE_REPOSITORY,
  type IZbsTemplateRepository,
} from '@/modules/integrations/domain/repositories/zbs-template.repository.interface';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { UpdateZbsTemplateStatusFromWebhookCommand } from './update-zbs-template-status-from-webhook.command';

@Injectable()
export class UpdateZbsTemplateStatusFromWebhookHandler {
  private readonly logger = new Logger(
    UpdateZbsTemplateStatusFromWebhookHandler.name,
  );

  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZBS_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IZbsTemplateRepository,
  ) {}

  async execute(cmd: UpdateZbsTemplateStatusFromWebhookCommand): Promise<void> {
    const connection = await this.connectionRepo.findByExternalId(
      IntegrationProviderEnum.ZALO_OA,
      cmd.oaId,
    );
    if (!connection) {
      this.logger.warn(
        `Không tìm thấy liên kết cho oa_id=${cmd.oaId}, bỏ qua webhook đổi trạng thái template.`,
      );
      return;
    }

    const template = await this.templateRepo.findByConnectionAndTemplateId(
      connection.getUuid(),
      cmd.templateId,
    );
    if (!template) {
      this.logger.warn(
        `Không tìm thấy template ${cmd.templateId} trong connection ${connection.getUuid()}, bỏ qua webhook.`,
      );
      return;
    }

    template.updateStatusFromWebhook(cmd.newStatus, cmd.reason);
    await this.templateRepo.save(template);
  }
}
