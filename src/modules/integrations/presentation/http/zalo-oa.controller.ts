import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
import { GetZbsTemplateHandler } from '../../application/queries/get-zbs-template/get-zbs-template.handler';
import { GetZbsTemplateQuery } from '../../application/queries/get-zbs-template/get-zbs-template.query';
import { CreateZbsTemplateDraftHandler } from '../../application/commands/create-zbs-template-draft/create-zbs-template-draft.handler';
import { CreateZbsTemplateDraftCommand } from '../../application/commands/create-zbs-template-draft/create-zbs-template-draft.command';
import { UpdateZbsTemplateDraftHandler } from '../../application/commands/update-zbs-template-draft/update-zbs-template-draft.handler';
import { UpdateZbsTemplateDraftCommand } from '../../application/commands/update-zbs-template-draft/update-zbs-template-draft.command';
import { DeleteZbsTemplateHandler } from '../../application/commands/delete-zbs-template/delete-zbs-template.handler';
import { DeleteZbsTemplateCommand } from '../../application/commands/delete-zbs-template/delete-zbs-template.command';
import { PublishZbsTemplateHandler } from '../../application/commands/publish-zbs-template/publish-zbs-template.handler';
import { PublishZbsTemplateCommand } from '../../application/commands/publish-zbs-template/publish-zbs-template.command';
import { SendZaloOaMessageDto } from '../../application/dtos/send-zalo-oa-message.dto';
import { CreateZbsTemplateDto } from '../../application/dtos/create-zbs-template.dto';
import { UpdateZbsTemplateDto } from '../../application/dtos/update-zbs-template.dto';

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
    private readonly getTemplateHandler: GetZbsTemplateHandler,
    private readonly createTemplateDraftHandler: CreateZbsTemplateDraftHandler,
    private readonly updateTemplateDraftHandler: UpdateZbsTemplateDraftHandler,
    private readonly deleteTemplateHandler: DeleteZbsTemplateHandler,
    private readonly publishTemplateHandler: PublishZbsTemplateHandler,
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

  @Post('templates')
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateZbsTemplateDto,
  ) {
    return this.createTemplateDraftHandler.execute(
      new CreateZbsTemplateDraftCommand(
        req.user.merchantId,
        dto.templateName,
        dto.templateType,
        dto.tag,
        dto.layout,
        dto.params,
        dto.note,
        dto.trackingId,
      ),
    );
  }

  @Get('templates/:uuid')
  async getTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('uuid') uuid: string,
  ) {
    return this.getTemplateHandler.execute(
      new GetZbsTemplateQuery(req.user.merchantId, uuid),
    );
  }

  @Patch('templates/:uuid')
  async updateTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('uuid') uuid: string,
    @Body() dto: UpdateZbsTemplateDto,
  ) {
    return this.updateTemplateDraftHandler.execute(
      new UpdateZbsTemplateDraftCommand(req.user.merchantId, uuid, dto),
    );
  }

  @Delete('templates/:uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('uuid') uuid: string,
  ) {
    await this.deleteTemplateHandler.execute(
      new DeleteZbsTemplateCommand(req.user.merchantId, uuid),
    );
  }

  @Post('templates/:uuid/publish')
  async publishTemplate(
    @Req() req: AuthenticatedRequest,
    @Param('uuid') uuid: string,
  ) {
    return this.publishTemplateHandler.execute(
      new PublishZbsTemplateCommand(req.user.merchantId, uuid),
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
