// src/modules/wallet/domain/repositories/wallet.repository.interface.ts
import type { Wallet } from '../models/wallet.aggregate';
import type { WalletTransaction } from '../models/wallet-transaction.entity';

export interface FindTransactionsResult {
  items: WalletTransaction[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface IWalletRepository {
  findByMerchantId(merchantId: string): Promise<Wallet | null>;
  findByMerchantIdWithLock(merchantId: string): Promise<Wallet | null>;
  save(wallet: Wallet, transaction?: WalletTransaction): Promise<void>;
  findTransactions(
    merchantId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<FindTransactionsResult>;
}

export const WALLET_REPOSITORY = Symbol('IWalletRepository');
