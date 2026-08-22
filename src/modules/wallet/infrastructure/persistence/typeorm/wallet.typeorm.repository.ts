// src/modules/wallet/infrastructure/persistence/typeorm/wallet.typeorm.repository.ts
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  IWalletRepository,
  FindTransactionsResult,
} from '../../../domain/repositories/wallet.repository.interface';
import { Wallet } from '../../../domain/models/wallet.aggregate';
import { WalletTransaction } from '../../../domain/models/wallet-transaction.entity';
import { WalletOrmEntity } from './entities/wallet.orm-entity';
import { WalletTransactionOrmEntity } from './entities/wallet-transaction.orm-entity';
import { WalletMapper } from '../../mappers/wallet.mapper';
import { paginateByUuidCursor } from '@/shared/infrastructure/persistence/cursor-pagination.util';

@Injectable()
export class WalletTypeormRepository implements IWalletRepository {
  constructor(
    @InjectRepository(WalletOrmEntity)
    private readonly walletOrmRepo: Repository<WalletOrmEntity>,
    @InjectRepository(WalletTransactionOrmEntity)
    private readonly txOrmRepo: Repository<WalletTransactionOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findByMerchantId(merchantId: string): Promise<Wallet | null> {
    const orm = await this.walletOrmRepo.findOne({ where: { merchantId } });
    return orm ? WalletMapper.toDomain(orm) : null;
  }

  async findByMerchantIdWithLock(merchantId: string): Promise<Wallet | null> {
    const orm = await this.walletOrmRepo.findOne({
      where: { merchantId },
      lock: { mode: 'pessimistic_write' },
    });
    return orm ? WalletMapper.toDomain(orm) : null;
  }

  async save(wallet: Wallet, transaction?: WalletTransaction): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const walletOrm = WalletMapper.toOrm(wallet);
      await manager.save(walletOrm);

      if (transaction) {
        // Chống trùng lặp mã giao dịch (Idempotency)
        const exist = await manager.findOne(WalletTransactionOrmEntity, {
          where: { code: transaction.getCode() },
        });
        if (!exist) {
          const txOrm = WalletMapper.transactionToOrm(transaction);
          await manager.save(txOrm);
        }
      }
    });
  }

  async findTransactions(
    merchantId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<FindTransactionsResult> {
    const wallet = await this.findByMerchantId(merchantId);
    if (!wallet) return { items: [], hasNextPage: false, nextCursor: null };

    const qb = this.txOrmRepo
      .createQueryBuilder('wt')
      .where('wt.walletId = :walletId', { walletId: wallet.getUUID() });

    const { items, meta } = await paginateByUuidCursor(qb, 'wt', {
      cursor,
      limit,
      order: 'DESC',
    });

    return {
      items: items.map(WalletMapper.transactionToDomain),
      hasNextPage: meta.hasNextPage,
      nextCursor: meta.nextCursor,
    };
  }
}
