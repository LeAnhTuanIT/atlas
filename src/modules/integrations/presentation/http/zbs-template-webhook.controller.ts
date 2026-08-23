import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyZbsTemplateWebhookSignature } from '../../infrastructure/webhook/verify-zbs-template-webhook-signature';
import { UpdateZbsTemplateStatusFromWebhookHandler } from '../../application/commands/update-zbs-template-status-from-webhook/update-zbs-template-status-from-webhook.handler';
import { UpdateZbsTemplateStatusFromWebhookCommand } from '../../application/commands/update-zbs-template-status-from-webhook/update-zbs-template-status-from-webhook.command';

@Controller({ path: 'integrations/zalo-oa', version: '1' })
export class ZbsTemplateWebhookController {
  private readonly logger = new Logger(ZbsTemplateWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly updateStatusHandler: UpdateZbsTemplateStatusFromWebhookHandler,
  ) {}

  @Post('webhook/template-status')
  @HttpCode(HttpStatus.OK)
  async handleTemplateStatusWebhook(
    @Body() body: any,
    @Headers('x-zevent-signature') signature: string | undefined,
  ) {
    const secretKey =
      this.configService.getOrThrow<string>('ZALO_OA_SECRET_KEY');

    if (!verifyZbsTemplateWebhookSignature(body, signature, secretKey)) {
      this.logger.warn(
        `Chữ ký webhook đổi trạng thái template không hợp lệ: ${JSON.stringify(body)}`,
      );
      return {}; // Luôn trả 200 để Zalo không retry bão, chỉ log cảnh báo
    }

    if (body?.event_name !== 'change_template_status') {
      this.logger.log(
        `Bỏ qua sự kiện webhook template không hỗ trợ: ${body?.event_name}`,
      );
      return {};
    }

    try {
      await this.updateStatusHandler.execute(
        new UpdateZbsTemplateStatusFromWebhookCommand(
          body.oa_id,
          body.template_id,
          body.status?.new_status,
          body.reason,
        ),
      );
    } catch (error: any) {
      this.logger.error(
        `Lỗi xử lý webhook đổi trạng thái template: ${error?.message}`,
      );
    }

    return {};
  }
}
