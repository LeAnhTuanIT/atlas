import { WalletTransaction } from '../models/wallet-transaction.entity';

export interface FindTransactionsOptions {
  walletId: string;
  limit?: number;
  offset?: number;
}

export interface IWalletTransactionRepository {
  findByWalletId(
    options: FindTransactionsOptions,
  ): Promise<{ items: WalletTransaction[]; total: number }>;
  save(transaction: WalletTransaction): Promise<void>;
}
