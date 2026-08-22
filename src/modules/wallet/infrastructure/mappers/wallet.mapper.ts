// src/modules/wallet/infrastructure/mappers/wallet.mapper.ts
import { Wallet } from '../../domain/models/wallet.aggregate';
import { Money } from '../../domain/value-objects/money.vo';
import { WalletOrmEntity } from '../persistence/typeorm/entities/wallet.orm-entity';
import { WalletTransaction } from '../../domain/models/wallet-transaction.entity';
import { WalletTransactionOrmEntity } from '../persistence/typeorm/entities/wallet-transaction.orm-entity';

export class WalletMapper {
  // 1. Wallet ORM -> Domain (Dùng factory reconstitute)
  static toDomain(orm: WalletOrmEntity): Wallet {
    return Wallet.reconstitute({
      id: orm.uuid,
      merchantId: orm.merchantId || (orm as any).merchant_id,
      balance: new Money(Number(orm.balance || 0), orm.currency || 'VND'),
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  // 2. Wallet Domain -> ORM
  static toOrm(domain: Wallet): WalletOrmEntity {
    const orm = new WalletOrmEntity();
    orm.uuid = domain.getUUID();
    orm.merchantId = domain.getMerchantId();
    orm.balance = domain.getBalance().getAmount();
    orm.currency = domain.getBalance().getCurrency();
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }

  // 3. Transaction ORM -> Domain (Dùng factory reconstitute)
  static transactionToDomain(
    orm: WalletTransactionOrmEntity,
  ): WalletTransaction {
    return WalletTransaction.reconstitute({
      id: orm.uuid,
      walletId: orm.walletId || (orm as any).wallet_id,
      merchantId: orm.merchantId || (orm as any).merchant_id,
      code: orm.code,
      type: orm.type,
      amount: new Money(Number(orm.amount || 0)),
      balanceAfter: new Money(
        Number(orm.balanceAfter || (orm as any).balance_after || 0),
      ),
      status: orm.status,
      description: orm.description || '',
      createdAt: orm.createdAt,
    });
  }

  // 4. Transaction Domain -> ORM
  static transactionToOrm(
    domain: WalletTransaction,
  ): WalletTransactionOrmEntity {
    const orm = new WalletTransactionOrmEntity();
    orm.uuid = domain.id;
    orm.walletId = domain.getWalletId();
    orm.merchantId = domain.getMerchantId();
    orm.code = domain.getCode();
    orm.type = domain.getType();
    orm.amount = domain.getAmount().getAmount();
    orm.balanceAfter = domain.getBalanceAfter().getAmount();
    orm.status = domain.getStatus();
    orm.description = domain.getDescription();
    orm.createdAt = domain.createdAt;
    return orm;
  }
}
