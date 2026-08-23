import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './infrastructure/database/database.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { QueueModule } from './infrastructure/queues/queue.module';
import { RabbitMQMessagingModule } from './infrastructure/messaging/rabbitmq/rabbitmq.module';
import { validateEnv } from './infrastructure/configs/env.validation';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { CorrelationIdMiddleware } from './shared/infrastructure/middlewares/correlation-id.middleware';
import { ClsModule } from 'nestjs-cls';
import { PaymentModule } from './modules/payment/payment.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    DatabaseModule,
    RedisModule,
    QueueModule,
    RabbitMQMessagingModule,
    SharedModule,
    AuthModule,
    MerchantModule,
    WalletModule,
    PaymentModule,
    IntegrationsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
