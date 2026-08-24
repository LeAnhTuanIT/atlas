import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentModule } from '../payment/payment.module';

import { TicketProductOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-product.orm-entity';
import { TicketZoneOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-zone.orm-entity';
import { TicketSessionOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-session.orm-entity';
import { TicketOrderOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-order.orm-entity';
import { TicketOrderLineOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-order-line.orm-entity';
import { TicketOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket.orm-entity';

import { TICKET_PRODUCT_REPOSITORY } from './domain/repositories/ticket-product.repository.interface';
import { TicketProductTypeormRepository } from './infrastructure/persistence/typeorm/ticket-product.typeorm.repository';
import { TICKET_ORDER_REPOSITORY } from './domain/repositories/ticket-order.repository.interface';
import { TicketOrderTypeormRepository } from './infrastructure/persistence/typeorm/ticket-order.typeorm.repository';
import { TICKET_REPOSITORY } from './domain/repositories/ticket.repository.interface';
import { TicketTypeormRepository } from './infrastructure/persistence/typeorm/ticket.typeorm.repository';

import { TicketAvailabilityService } from './infrastructure/redis/ticket-availability.service';
import { ExpirePendingTicketOrdersCron } from './infrastructure/jobs/expire-pending-ticket-orders.cron';

import { CreateTicketProductHandler } from './application/commands/create-ticket-product/create-ticket-product.handler';
import { PublishTicketProductHandler } from './application/commands/publish-ticket-product/publish-ticket-product.handler';
import { CreateTicketOrderHandler } from './application/commands/create-ticket-order/create-ticket-order.handler';
import { ConfirmTicketOrderPaymentHandler } from './application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler';
import { CancelTicketOrderHandler } from './application/commands/cancel-ticket-order/cancel-ticket-order.handler';
import { CancelPaidTicketOrderHandler } from './application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.handler';

import { MerchantTicketProductController } from './presentation/controllers/merchant-ticket-product.controller';
import {
  CustomerTicketOrderController,
  MerchantTicketOrderController,
} from './presentation/controllers/ticket-order.controller';
import { TicketOrderWebhookController } from './presentation/controllers/ticket-order-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketProductOrmEntity,
      TicketZoneOrmEntity,
      TicketSessionOrmEntity,
      TicketOrderOrmEntity,
      TicketOrderLineOrmEntity,
      TicketOrmEntity,
    ]),
    PaymentModule,
  ],
  controllers: [
    MerchantTicketProductController,
    CustomerTicketOrderController,
    MerchantTicketOrderController,
    TicketOrderWebhookController,
  ],
  providers: [
    TicketAvailabilityService,
    ExpirePendingTicketOrdersCron,
    CreateTicketProductHandler,
    PublishTicketProductHandler,
    CreateTicketOrderHandler,
    ConfirmTicketOrderPaymentHandler,
    CancelTicketOrderHandler,
    CancelPaidTicketOrderHandler,
    { provide: TICKET_PRODUCT_REPOSITORY, useClass: TicketProductTypeormRepository },
    { provide: TICKET_ORDER_REPOSITORY, useClass: TicketOrderTypeormRepository },
    { provide: TICKET_REPOSITORY, useClass: TicketTypeormRepository },
  ],
})
export class TicketModule {}
