import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MerchantAuthGuard } from '@/shared/infrastructure/auth/guards/auth-guards.guards';
import { IntegrationProviderEnum } from '../../domain/value-objects/integration-provider.vo';
import { ZaloOaStateService } from '../../infrastructure/services/zalo-oa-state.service';
import { ZaloOaGateway } from '../../infrastructure/gateways/zalo-oa.gateway';
import { GetIntegrationStatusHandler } from '../../application/queries/get-integration-status/get-integration-status.handler';
import { GetIntegrationStatusQuery } from '../../application/queries/get-integration-status/get-integration-status.query';
import { SendZaloOaMessageHandler } from '../../application/commands/send-zalo-oa-message/send-zalo-oa-message.handler';
import { SendZaloOaMessageCommand } from '../../application/commands/send-zalo-oa-message/send-zalo-oa-message.command';
import { SyncZbsTemplatesHandler } from '../../application/commands/sync-zbs-templates/sync-zbs-templates.handler';
import { SyncZbsTemplatesCommand } from '../../application/commands/sync-zbs-templates/sync-zbs-templates.command';
import { ListZbsTemplatesHandler } from '../../application/queries/list-zbs-templates/list-zbs-templates.handler';
import { ListZbsTemplatesQuery } from '../../application/queries/list-zbs-templates/list-zbs-templates.query';
import { SendZaloOaMessageDto } from '../../application/dtos/send-zalo-oa-message.dto';

interface AuthenticatedRequest extends Request {
  user: { merchantId: string };
}

@Controller({ path: 'merchant/integrations/zalo-oa', version: '1' })
@UseGuards(MerchantAuthGuard)
export class ZaloOaController {
  constructor(
    private readonly stateService: ZaloOaStateService,
    private readonly zaloOaGateway: ZaloOaGateway,
    private readonly getStatusHandler: GetIntegrationStatusHandler,
    private readonly sendMessageHandler: SendZaloOaMessageHandler,
    private readonly syncTemplatesHandler: SyncZbsTemplatesHandler,
    private readonly listTemplatesHandler: ListZbsTemplatesHandler,
  ) {}

  @Get('connect-url')
  async getConnectUrl(@Req() req: AuthenticatedRequest) {
    const state = await this.stateService.signState(req.user.merchantId);
    return { url: this.zaloOaGateway.getAuthUrl(state) };
  }

  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest) {
    return this.getStatusHandler.execute(
      new GetIntegrationStatusQuery(
        req.user.merchantId,
        IntegrationProviderEnum.ZALO_OA,
      ),
    );
  }

  @Get('templates')
  async listTemplates(@Req() req: AuthenticatedRequest) {
    return this.listTemplatesHandler.execute(
      new ListZbsTemplatesQuery(req.user.merchantId),
    );
  }

  @Post('templates/sync')
  async syncTemplates(@Req() req: AuthenticatedRequest) {
    return this.syncTemplatesHandler.execute(
      new SyncZbsTemplatesCommand(req.user.merchantId),
    );
  }

  @Post('messages')
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendZaloOaMessageDto,
  ) {
    return this.sendMessageHandler.execute(
      new SendZaloOaMessageCommand(
        req.user.merchantId,
        dto.to,
        dto.content,
        dto.type,
      ),
    );
  }
}
