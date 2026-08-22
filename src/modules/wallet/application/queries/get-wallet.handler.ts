// src/modules/wallet/application/queries/get-wallet.handler.ts
import { Inject, Injectable } from '@nestjs/common';
import { WALLET_REPOSITORY } from '../../domain/repositories/wallet.repository.interface';
import type { IWalletRepository } from '../../domain/repositories/wallet.repository.interface';
import { Wallet } from '../../domain/models/wallet.aggregate';

@Injectable()
export class GetWalletHandler {
  constructor(
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepo: IWalletRepository,
  ) {}

  async execute(merchantId: string) {
    let wallet = await this.walletRepo.findByMerchantId(merchantId);
    if (!wallet) {
      wallet = Wallet.create(merchantId);
      await this.walletRepo.save(wallet);
    }

    return {
      id: wallet.id,
      merchantId: wallet.getMerchantId(),
      balance: wallet.getBalance().getAmount(),
      currency: wallet.getBalance().getCurrency(),
    };
  }
}
