import { Inject, Injectable, Logger } from '@nestjs/common';
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
import { SyncZaloOaWebhookEventCommand } from './sync-zalo-oa-webhook-event.command';

const SUPPORTED_INBOUND_EVENTS = new Set(['user_send_text']);

@Injectable()
export class SyncZaloOaWebhookEventHandler {
  private readonly logger = new Logger(SyncZaloOaWebhookEventHandler.name);

  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZALO_OA_MESSAGE_REPOSITORY)
    private readonly messageRepo: IZaloOaMessageRepository,
  ) {}

  async execute(cmd: SyncZaloOaWebhookEventCommand): Promise<void> {
    if (!SUPPORTED_INBOUND_EVENTS.has(cmd.eventName)) {
      this.logger.log(
        `Bỏ qua sự kiện webhook Zalo OA không được đồng bộ: ${cmd.eventName}`,
      );
      return;
    }

    const connection = await this.connectionRepo.findByExternalId(
      IntegrationProviderEnum.ZALO_OA,
      cmd.oaId,
    );
    if (!connection) {
      this.logger.warn(
        `Không tìm thấy liên kết cho oa_id=${cmd.oaId}, bỏ qua sự kiện webhook.`,
      );
      return;
    }

    if (cmd.messageId) {
      const exists = await this.messageRepo.existsByExternalMessageId(
        connection.getUuid(),
        cmd.messageId,
      );
      if (exists) {
        return; // Idempotent — Zalo có thể gửi lại webhook trùng
      }
    }

    const message = ZaloOaMessage.create({
      connectionId: connection.getUuid(),
      direction: ZaloOaMessageDirectionEnum.IN,
      zaloUserId: cmd.senderId,
      content: cmd.messageText,
      messageType: 'text',
      externalMessageId: cmd.messageId,
      sentAt: new Date(cmd.timestamp * 1000),
    });

    await this.messageRepo.save(message);
  }
}
