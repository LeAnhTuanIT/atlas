// src/modules/payment/infrastructure/mappers/payment-order.mapper.ts
import { PaymentOrder } from '../../domain/models/payment-order.aggregate';
import { PaymentOrderOrmEntity } from '../persistence/typeorm/entities/payment-order.orm-entity';

export class PaymentOrderMapper {
  static toDomain(orm: PaymentOrderOrmEntity): PaymentOrder {
    return new PaymentOrder(
      orm.orderCode,
      orm.merchantId,
      orm.amount,
      orm.gateway,
      orm.status,
      orm.paymentUrl,
      orm.paidAt,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: PaymentOrder): PaymentOrderOrmEntity {
    const orm = new PaymentOrderOrmEntity();
    orm.orderCode = domain.getOrderCode();
    orm.merchantId = domain.getMerchantId();
    orm.amount = domain.getAmount();
    orm.gateway = domain.getGateway();
    orm.status = domain.getStatus();
    orm.paymentUrl = domain.getPaymentUrl() as string;
    orm.paidAt = domain.getPaidAt() as Date;
    return orm;
  }
}
