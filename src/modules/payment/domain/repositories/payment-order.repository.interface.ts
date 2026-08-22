// src/modules/payment/domain/repositories/payment-order.repository.interface.ts
import type { PaymentOrder } from '../models/payment-order.aggregate';

export interface IPaymentOrderRepository {
  findByOrderCode(orderCode: string): Promise<PaymentOrder | null>;
  save(order: PaymentOrder): Promise<void>;
}
export const PAYMENT_ORDER_REPOSITORY = Symbol('IPaymentOrderRepository');
