// src/modules/wallet/domain/value-objects/transaction-type.vo.ts
export enum TransactionTypeEnum {
  DEPOSIT = 'DEPOSIT',
  WITHDRAW = 'WITHDRAW',
  FEATURE_SUBSCRIPTION = 'FEATURE_SUBSCRIPTION',
  REFUND = 'REFUND',
}

export enum TransactionStatusEnum {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}
