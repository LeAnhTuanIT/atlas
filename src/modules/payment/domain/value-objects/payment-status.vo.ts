// src/modules/payment/domain/value-objects/payment-status.vo.ts
export enum PaymentGatewayEnum {
  PAYOS = 'PAYOS',
  VNPAY = 'VNPAY',
  MOMO = 'MOMO',
}

export enum PaymentStatusEnum {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}
