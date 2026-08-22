// src/modules/wallet/domain/models/wallet-transaction.entity.ts
import {
  TransactionTypeEnum,
  TransactionStatusEnum,
} from '../value-objects/transaction-type.vo';
import { Money } from '../value-objects/money.vo';
import { randomUUID } from 'crypto';
import { BaseEntity } from '@/shared/domain/base.entity';

export class WalletTransaction extends BaseEntity<string> {
  private constructor(
    id: string,
    private readonly walletId: string,
    private readonly merchantId: string,
    private readonly code: string,
    private readonly type: TransactionTypeEnum,
    private readonly amount: Money,
    private readonly balanceAfter: Money,
    private readonly status: TransactionStatusEnum,
    private readonly description: string,
    createdAt: Date = new Date(),
  ) {
    super(id, createdAt, createdAt);
  }

  // 1. Factory method tạo mới giao dịch từ domain
  static create(params: {
    id?: string;
    walletId: string;
    merchantId: string;
    code: string;
    type: TransactionTypeEnum;
    amount: Money;
    balanceAfter: Money;
    description: string;
    status?: TransactionStatusEnum;
  }): WalletTransaction {
    if (!params.walletId) {
      throw new Error('Wallet ID is required for a transaction');
    }
    if (!params.merchantId) {
      throw new Error('Merchant ID is required for a transaction');
    }
    if (!params.code) {
      throw new Error('Transaction code is required');
    }

    return new WalletTransaction(
      params.id || randomUUID(),
      params.walletId,
      params.merchantId,
      params.code,
      params.type,
      params.amount,
      params.balanceAfter,
      params.status || TransactionStatusEnum.SUCCESS,
      params.description,
      new Date(),
    );
  }

  // 2. Factory method tái cấu trúc entity từ Database (ORM Mapper)
  static reconstitute(params: {
    id: string;
    walletId: string;
    merchantId: string;
    code: string;
    type: TransactionTypeEnum;
    amount: Money;
    balanceAfter: Money;
    status: TransactionStatusEnum;
    description: string;
    createdAt: Date;
  }): WalletTransaction {
    return new WalletTransaction(
      params.id,
      params.walletId,
      params.merchantId,
      params.code,
      params.type,
      params.amount,
      params.balanceAfter,
      params.status,
      params.description,
      params.createdAt,
    );
  }

  // 3. Getters
  getWalletId(): string {
    return this.walletId;
  }
  getMerchantId(): string {
    return this.merchantId;
  }
  getCode(): string {
    return this.code;
  }
  getType(): TransactionTypeEnum {
    return this.type;
  }
  getAmount(): Money {
    return this.amount;
  }
  getBalanceAfter(): Money {
    return this.balanceAfter;
  }
  getStatus(): TransactionStatusEnum {
    return this.status;
  }
  getDescription(): string {
    return this.description;
  }

  // 4. Domain Helper Methods
  isSuccess(): boolean {
    return this.status === TransactionStatusEnum.SUCCESS;
  }

  isDeposit(): boolean {
    return this.type === TransactionTypeEnum.DEPOSIT;
  }

  // 5. Convert sang plain object cho DTO / Response
  toPrimitives() {
    return {
      id: this.id,
      walletId: this.walletId,
      merchantId: this.merchantId,
      code: this.code,
      type: this.type,
      amount: this.amount.getAmount(),
      currency: this.amount.getCurrency(),
      balanceAfter: this.balanceAfter.getAmount(),
      status: this.status,
      description: this.description,
      createdAt: this.createdAt,
    };
  }
}
