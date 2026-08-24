// src/modules/payment/payment.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentOrderOrmEntity } from './infrastructure/persistence/typeorm/entities/payment-order.orm-entity';
import { PAYMENT_ORDER_REPOSITORY } from './domain/repositories/payment-order.repository.interface';
import { PaymentOrderTypeormRepository } from './infrastructure/persistence/typeorm/payment-order.typeorm.repository';
import { PayosGateway } from './infrastructure/gateways/payos.gateway';
import { VnPayGateway } from './infrastructure/gateways/vnpay.gateway';
import { MoMoGateway } from './infrastructure/gateways/momo.gateway';
import { PaymentGatewayFactory } from './infrastructure/gateways/payment-gateway.factory';
import { CreateDepositOrderHandler } from './application/commands/create-deposit-order.handler';
import { ProcessPaymentWebhookHandler } from './application/commands/process-payment-webhook.handler';
import { PaymentController } from './presentation/controllers/payment.controller';
import { PaymentWebhookController } from './presentation/controllers/payment-webhook.controller';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentOrderOrmEntity]),
    WalletModule,
    AuthModule,
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    // Gateways & Factory
    PayosGateway,
    VnPayGateway,
    MoMoGateway,
    PaymentGatewayFactory,

    // Handlers
    CreateDepositOrderHandler,
    ProcessPaymentWebhookHandler,

    // Repositories
    {
      provide: PAYMENT_ORDER_REPOSITORY,
      useClass: PaymentOrderTypeormRepository,
    },
  ],
  exports: [CreateDepositOrderHandler, ProcessPaymentWebhookHandler, PaymentGatewayFactory],
})
export class PaymentModule {}
