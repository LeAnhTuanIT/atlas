import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyZaloOaWebhookSignature } from '../../infrastructure/webhook/verify-zalo-oa-webhook-signature';
import { SyncZaloOaWebhookEventHandler } from '../../application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler';
import { SyncZaloOaWebhookEventCommand } from '../../application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.command';

@Controller({ path: 'integrations/zalo-oa', version: '1' })
export class ZaloOaWebhookController {
  private readonly logger = new Logger(ZaloOaWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly syncHandler: SyncZaloOaWebhookEventHandler,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any) {
    const secretKey =
      this.configService.getOrThrow<string>('ZALO_OA_SECRET_KEY');

    if (!verifyZaloOaWebhookSignature(body, secretKey)) {
      this.logger.warn(
        `Chữ ký webhook Zalo OA không hợp lệ: ${JSON.stringify(body)}`,
      );
      return {}; // Luôn trả 200 để Zalo không retry bão, chỉ log cảnh báo
    }

    try {
      await this.syncHandler.execute(
        new SyncZaloOaWebhookEventCommand(
          body.oa_id,
          body.event_name,
          body.sender?.id,
          body.message?.text,
          body.message?.msg_id,
          Number(body.timestamp) || Math.floor(Date.now() / 1000),
        ),
      );
    } catch (error: any) {
      this.logger.error(`Lỗi xử lý sự kiện webhook Zalo OA: ${error?.message}`);
    }

    return {};
  }
}
