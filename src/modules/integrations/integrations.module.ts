import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { IntegrationConnectionOrmEntity } from './infrastructure/persistence/entities/integration-connection.orm-entity';
import { ZaloOaMessageOrmEntity } from './infrastructure/persistence/entities/zalo-oa-message.orm-entity';
import { INTEGRATION_CONNECTION_REPOSITORY } from './domain/repositories/integration-connection.repository.interface';
import { TypeOrmIntegrationConnectionRepository } from './infrastructure/persistence/repositories/typeorm-integration-connection.repository';
import { ZALO_OA_MESSAGE_REPOSITORY } from './domain/repositories/zalo-oa-message.repository.interface';
import { TypeOrmZaloOaMessageRepository } from './infrastructure/persistence/repositories/typeorm-zalo-oa-message.repository';
import { ZaloOaGateway } from './infrastructure/gateways/zalo-oa.gateway';
import { IntegrationGatewayFactory } from './infrastructure/gateways/integration-gateway.factory';
import { MESSAGING_GATEWAYS } from './infrastructure/gateways/messaging-gateways.token';
import { ZaloOaStateService } from './infrastructure/services/zalo-oa-state.service';
import { ZALO_OA_OAUTH_CONNECTABLE } from './application/ports/zalo-oa-oauth-connectable.token';
import { LinkZaloOaHandler } from './application/commands/link-zalo-oa/link-zalo-oa.handler';
import { SendZaloOaMessageHandler } from './application/commands/send-zalo-oa-message/send-zalo-oa-message.handler';
import { SyncZaloOaWebhookEventHandler } from './application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler';
import { GetIntegrationStatusHandler } from './application/queries/get-integration-status/get-integration-status.handler';
import { ListZaloOaMessagesHandler } from './application/queries/list-zalo-oa-messages/list-zalo-oa-messages.handler';
import { ZaloOaController } from './presentation/http/zalo-oa.controller';
import { ZaloOaCallbackController } from './presentation/http/zalo-oa-callback.controller';
import { ZaloOaWebhookController } from './presentation/http/zalo-oa-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationConnectionOrmEntity,
      ZaloOaMessageOrmEntity,
    ]),
    JwtModule.register({}),
  ],
  controllers: [
    ZaloOaController,
    ZaloOaCallbackController,
    ZaloOaWebhookController,
  ],
  providers: [
    {
      provide: INTEGRATION_CONNECTION_REPOSITORY,
      useClass: TypeOrmIntegrationConnectionRepository,
    },
    {
      provide: ZALO_OA_MESSAGE_REPOSITORY,
      useClass: TypeOrmZaloOaMessageRepository,
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
    SyncZaloOaWebhookEventHandler,
    GetIntegrationStatusHandler,
    ListZaloOaMessagesHandler,
  ],
  exports: [INTEGRATION_CONNECTION_REPOSITORY],
})
export class IntegrationsModule {}
