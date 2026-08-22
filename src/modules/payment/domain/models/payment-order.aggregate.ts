// src/modules/payment/domain/models/payment-order.aggregate.ts
import { BaseEntity } from '@/shared/domain/base.entity';
import {
  PaymentStatusEnum,
  PaymentGatewayEnum,
} from '../value-objects/payment-status.vo';

export class PaymentOrder extends BaseEntity<string> {
  constructor(
    orderCode: string,
    private readonly merchantId: string,
    private readonly amount: number,
    private readonly gateway: PaymentGatewayEnum,
    private status: PaymentStatusEnum,
    private paymentUrl?: string,
    private paidAt?: Date,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(orderCode, createdAt, updatedAt);
  }

  static create(
    orderCode: string,
    merchantId: string,
    amount: number,
    gateway: PaymentGatewayEnum,
  ): PaymentOrder {
    return new PaymentOrder(
      orderCode,
      merchantId,
      amount,
      gateway,
      PaymentStatusEnum.PENDING,
    );
  }

  markAsPaid(): void {
    if (this.status === PaymentStatusEnum.PAID) {
      return; // Idempotent
    }
    this.status = PaymentStatusEnum.PAID;
    this.paidAt = new Date();
    this._updatedAt = new Date();
  }

  setPaymentUrl(url: string): void {
    this.paymentUrl = url;
    this._updatedAt = new Date();
  }

  getOrderCode(): string {
    return this.id;
  }
  getMerchantId(): string {
    return this.merchantId;
  }
  getAmount(): number {
    return this.amount;
  }
  getGateway(): PaymentGatewayEnum {
    return this.gateway;
  }
  getStatus(): PaymentStatusEnum {
    return this.status;
  }
  getPaymentUrl(): string | undefined {
    return this.paymentUrl;
  }
  getPaidAt(): Date | undefined {
    return this.paidAt;
  }
}
