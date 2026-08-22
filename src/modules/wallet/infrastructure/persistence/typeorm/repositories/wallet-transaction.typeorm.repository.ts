import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IWalletTransactionRepository,
  FindTransactionsOptions,
} from '../../../../domain/repositories/wallet-transaction.repository.interface';
import { WalletTransaction } from '../../../../domain/models/wallet-transaction.entity';
import { WalletTransactionOrmEntity } from '../entities/wallet-transaction.orm-entity';
import { Money } from '@/modules/wallet/domain/value-objects/money.vo';

@Injectable()
export class WalletTransactionTypeOrmRepository implements IWalletTransactionRepository {
  constructor(
    @InjectRepository(WalletTransactionOrmEntity)
    private readonly repo: Repository<WalletTransactionOrmEntity>,
  ) {}

  async findByWalletId(
    options: FindTransactionsOptions,
  ): Promise<{ items: WalletTransaction[]; total: number }> {
    const [records, total] = await this.repo.findAndCount({
      where: { walletId: options.walletId },
      order: { createdAt: 'DESC' },
      take: options.limit,
      skip: options.offset,
    });

    const items = records.map((orm) =>
      // Use your domain entity's static factory method (e.g. reconstitute, create, or fromPersistence)
      WalletTransaction.reconstitute({
        id: orm.uuid,
        walletId: orm.walletId,
        merchantId: orm.merchantId,
        code: orm.code,
        type: orm.type,
        amount: Number(orm.amount) as unknown as Money,
        balanceAfter: Number(orm.balanceAfter) as unknown as Money,
        status: orm.status,
        description: orm.description,
        createdAt: orm.createdAt,
      }),
    );

    return { items, total };
  }

  async save(transaction: WalletTransaction): Promise<void> {
    const orm = new WalletTransactionOrmEntity();
    orm.uuid = transaction.id;
    orm.walletId = transaction.getWalletId();
    orm.merchantId = transaction.getMerchantId();
    orm.code = transaction.getCode();
    orm.type = transaction.getType();
    orm.amount = Number(transaction.getAmount());
    orm.balanceAfter = Number(transaction.getBalanceAfter());
    orm.status = transaction.getStatus();
    orm.description = transaction.getDescription();
    orm.createdAt = transaction.createdAt;

    await this.repo.save(orm);
  }
}
