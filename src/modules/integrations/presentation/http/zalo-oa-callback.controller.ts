import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ZaloOaStateService } from '../../infrastructure/services/zalo-oa-state.service';
import { LinkZaloOaHandler } from '../../application/commands/link-zalo-oa/link-zalo-oa.handler';
import { LinkZaloOaCommand } from '../../application/commands/link-zalo-oa/link-zalo-oa.command';

@Controller({ path: 'integrations/zalo-oa', version: '1' })
export class ZaloOaCallbackController {
  private readonly logger = new Logger(ZaloOaCallbackController.name);

  constructor(
    private readonly stateService: ZaloOaStateService,
    private readonly linkHandler: LinkZaloOaHandler,
    private readonly configService: ConfigService,
  ) {}

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('oa_id') oaId: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const redirectBase =
      this.configService.get<string>('APP_BASE_URL') ||
      'http://localhost:3000';
    const redirectTo = `${redirectBase}/merchant/integrations/zalo-oa`;

    try {
      const { merchantId } = await this.stateService.verifyState(state);
      await this.linkHandler.execute(
        new LinkZaloOaCommand(merchantId, code, oaId),
      );
      return res.redirect(`${redirectTo}?status=success`);
    } catch (error: any) {
      this.logger.error(`Lỗi xử lý callback Zalo OA: ${error?.message}`);
      return res.redirect(`${redirectTo}?status=error`);
    }
  }
}
