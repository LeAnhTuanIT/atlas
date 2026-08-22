// src/modules/wallet/domain/models/wallet.aggregate.ts
import { randomUUID } from 'crypto';
import { BaseEntity } from '@/shared/domain/base.entity';
import { Money } from '../value-objects/money.vo';
import { WalletTransaction } from './wallet-transaction.entity';
import {
  TransactionTypeEnum,
  TransactionStatusEnum,
} from '../value-objects/transaction-type.vo';

export class Wallet extends BaseEntity<string> {
  private transactions: WalletTransaction[] = [];

  constructor(
    id: string,
    private readonly merchantId: string,
    private balance: Money,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date(),
  ) {
    super(id, createdAt, updatedAt);
  }

  // 1. Tạo mới ví khi Merchant đăng ký
  static create(merchantId: string, currency = 'VND', id?: string): Wallet {
    if (!merchantId) {
      throw new Error('Merchant ID is required to create a Wallet');
    }
    return new Wallet(
      id || randomUUID(),
      merchantId,
      new Money(0, currency),
      new Date(),
      new Date(),
    );
  }

  // 2. Khôi phục từ Database (ORM)
  static reconstitute(params: {
    id: string;
    merchantId: string;
    balance: Money;
    createdAt?: Date;
    updatedAt?: Date;
  }): Wallet {
    return new Wallet(
      params.id,
      params.merchantId,
      params.balance,
      params.createdAt || new Date(),
      params.updatedAt || new Date(),
    );
  }

  // 3. Nghiệp vụ nạp tiền
  deposit(
    amount: Money,
    referenceCode: string,
    description: string,
  ): WalletTransaction {
    if (amount.getAmount() <= 0) {
      throw new Error('Số tiền nạp vào ví phải lớn hơn 0');
    }

    this.balance = this.balance.add(amount);
    this._updatedAt = new Date();

    const transaction = WalletTransaction.create({
      id: randomUUID(),
      walletId: this.id,
      merchantId: this.merchantId,
      code: referenceCode,
      type: TransactionTypeEnum.DEPOSIT,
      amount,
      balanceAfter: this.balance,
      status: TransactionStatusEnum.SUCCESS,
      description,
    });

    this.transactions.push(transaction);
    return transaction;
  }

  // 4. Nghiệp vụ trừ tiền / mua gói
  deduct(
    amount: Money,
    referenceCode: string,
    description: string,
    type: TransactionTypeEnum = TransactionTypeEnum.FEATURE_SUBSCRIPTION,
  ): WalletTransaction {
    if (amount.getAmount() <= 0) {
      throw new Error('Số tiền thanh toán phải lớn hơn 0');
    }

    if (this.balance.getAmount() < amount.getAmount()) {
      throw new Error(
        `Số dư ví không đủ (Hiện tại: ${this.balance.getAmount()}, Cần: ${amount.getAmount()})`,
      );
    }

    this.balance = this.balance.subtract(amount);
    this._updatedAt = new Date();

    const transaction = WalletTransaction.create({
      id: randomUUID(),
      walletId: this.id,
      merchantId: this.merchantId,
      code: referenceCode,
      type,
      amount,
      balanceAfter: this.balance,
      status: TransactionStatusEnum.SUCCESS,
      description,
    });

    this.transactions.push(transaction);
    return transaction;
  }

  // 5. Getters & Helpers
  getUUID(): string {
    return this.id;
  }
  getMerchantId(): string {
    return this.merchantId;
  }
  getBalance(): Money {
    return this.balance;
  }
  getUncommittedTransactions(): WalletTransaction[] {
    return [...this.transactions];
  }

  toPrimitives() {
    return {
      id: this.id,
      merchantId: this.merchantId,
      balance: this.balance.getAmount(),
      currency: this.balance.getCurrency(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
