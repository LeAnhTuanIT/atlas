import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { IntegrationConnectionOrmEntity } from './infrastructure/persistence/entities/integration-connection.orm-entity';
import { ZbsTemplateOrmEntity } from './infrastructure/persistence/entities/zbs-template.orm-entity';
import { INTEGRATION_CONNECTION_REPOSITORY } from './domain/repositories/integration-connection.repository.interface';
import { TypeOrmIntegrationConnectionRepository } from './infrastructure/persistence/repositories/typeorm-integration-connection.repository';
import { ZBS_TEMPLATE_REPOSITORY } from './domain/repositories/zbs-template.repository.interface';
import { TypeOrmZbsTemplateRepository } from './infrastructure/persistence/repositories/typeorm-zbs-template.repository';
import { ZaloOaGateway } from './infrastructure/gateways/zalo-oa.gateway';
import { IntegrationGatewayFactory } from './infrastructure/gateways/integration-gateway.factory';
import { MESSAGING_GATEWAYS } from './infrastructure/gateways/messaging-gateways.token';
import { ZaloOaStateService } from './infrastructure/services/zalo-oa-state.service';
import { ZALO_OA_OAUTH_CONNECTABLE } from './application/ports/zalo-oa-oauth-connectable.token';
import { LinkZaloOaHandler } from './application/commands/link-zalo-oa/link-zalo-oa.handler';
import { SendZaloOaMessageHandler } from './application/commands/send-zalo-oa-message/send-zalo-oa-message.handler';
import { SyncZbsTemplatesHandler } from './application/commands/sync-zbs-templates/sync-zbs-templates.handler';
import { CreateZbsTemplateDraftHandler } from './application/commands/create-zbs-template-draft/create-zbs-template-draft.handler';
import { UpdateZbsTemplateDraftHandler } from './application/commands/update-zbs-template-draft/update-zbs-template-draft.handler';
import { DeleteZbsTemplateHandler } from './application/commands/delete-zbs-template/delete-zbs-template.handler';
import { PublishZbsTemplateHandler } from './application/commands/publish-zbs-template/publish-zbs-template.handler';
import { UpdateZbsTemplateStatusFromWebhookHandler } from './application/commands/update-zbs-template-status-from-webhook/update-zbs-template-status-from-webhook.handler';
import { GetIntegrationStatusHandler } from './application/queries/get-integration-status/get-integration-status.handler';
import { ListZbsTemplatesHandler } from './application/queries/list-zbs-templates/list-zbs-templates.handler';
import { GetZbsTemplateHandler } from './application/queries/get-zbs-template/get-zbs-template.handler';
import { ZaloOaController } from './presentation/http/zalo-oa.controller';
import { ZaloOaCallbackController } from './presentation/http/zalo-oa-callback.controller';
import { ZbsTemplateWebhookController } from './presentation/http/zbs-template-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationConnectionOrmEntity,
      ZbsTemplateOrmEntity,
    ]),
    JwtModule.register({}),
  ],
  controllers: [
    ZaloOaController,
    ZaloOaCallbackController,
    ZbsTemplateWebhookController,
  ],
  providers: [
    {
      provide: INTEGRATION_CONNECTION_REPOSITORY,
      useClass: TypeOrmIntegrationConnectionRepository,
    },
    {
      provide: ZBS_TEMPLATE_REPOSITORY,
      useClass: TypeOrmZbsTemplateRepository,
    },
    ZaloOaGateway,
    {
      provide: MESSAGING_GATEWAYS,
      useFactory: (zaloOaGateway: ZaloOaGateway) => [zaloOaGateway],
      inject: [ZaloOaGateway],
    },
    {
      provide: ZALO_OA_OAUTH_CONNECTABLE,
      useExisting: ZaloOaGateway,
    },
    IntegrationGatewayFactory,
    ZaloOaStateService,
    LinkZaloOaHandler,
    SendZaloOaMessageHandler,
    SyncZbsTemplatesHandler,
    CreateZbsTemplateDraftHandler,
    UpdateZbsTemplateDraftHandler,
    DeleteZbsTemplateHandler,
    PublishZbsTemplateHandler,
    UpdateZbsTemplateStatusFromWebhookHandler,
    GetIntegrationStatusHandler,
    ListZbsTemplatesHandler,
    GetZbsTemplateHandler,
  ],
  exports: [INTEGRATION_CONNECTION_REPOSITORY],
})
export class IntegrationsModule {}
