// src/modules/wallet/wallet.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WalletOrmEntity } from './infrastructure/persistence/typeorm/entities/wallet.orm-entity';
import { WalletTransactionOrmEntity } from './infrastructure/persistence/typeorm/entities/wallet-transaction.orm-entity';
import { WALLET_REPOSITORY } from './domain/repositories/wallet.repository.interface';
import { WalletTypeormRepository } from './infrastructure/persistence/typeorm/wallet.typeorm.repository';
import { DepositWalletHandler } from './application/commands/deposit-wallet.handler';
import { GetWalletHandler } from './application/queries/get-wallet.handler';
import { MerchantWalletController } from './presentation/controllers/merchant-wallet.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([WalletOrmEntity, WalletTransactionOrmEntity]),
  ],
  controllers: [MerchantWalletController],
  providers: [
    DepositWalletHandler,
    GetWalletHandler,
    {
      provide: WALLET_REPOSITORY,
      useClass: WalletTypeormRepository,
    },
  ],
  exports: [DepositWalletHandler, WALLET_REPOSITORY],
})
export class WalletModule {}
