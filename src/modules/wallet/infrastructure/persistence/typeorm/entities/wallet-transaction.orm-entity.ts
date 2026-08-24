// src/modules/wallet/infrastructure/persistence/typeorm/entities/wallet-transaction.orm-entity.ts
import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import {
  TransactionTypeEnum,
  TransactionStatusEnum,
} from '../../../../domain/value-objects/transaction-type.vo';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { WalletOrmEntity } from './wallet.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';

@Entity('wallet_transactions')
export class WalletTransactionOrmEntity extends BaseOrmEntity {
  @Column({ name: 'wallet_id', type: 'uuid' })
  walletId: string;

  @ManyToOne(() => WalletOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'wallet_id', referencedColumnName: 'uuid' })
  // Typed `any` (not the concrete class) to avoid an emitDecoratorMetadata TDZ crash
  // on circular-imported ManyToOne/OneToOne relation properties.
  wallet: any;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  merchant: any;

  @Column({
    name: 'transaction_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  transactionId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'enum', enum: TransactionTypeEnum })
  type: TransactionTypeEnum;

  @Column({
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  amount: number;

  @Column({
    name: 'balance_after',
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  balanceAfter: number;

  @Column({
    type: 'enum',
    enum: TransactionStatusEnum,
    default: TransactionStatusEnum.SUCCESS,
  })
  status: TransactionStatusEnum;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode?: string;

  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  errorMessage?: string;
}
