// src/modules/wallet/infrastructure/persistence/typeorm/entities/wallet.orm-entity.ts
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { Entity, Column, Index, OneToOne, JoinColumn } from 'typeorm';

@Entity('wallets')
export class WalletOrmEntity extends BaseOrmEntity {
  // Mỗi merchant chỉ có đúng 1 ví (unique) => quan hệ 1-1, không phải N-1.
  @Index({ unique: true })
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @OneToOne(() => MerchantOrmEntity, (merchant) => merchant.wallet, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  merchant: MerchantOrmEntity;

  // tiền hiện dùng được
  @Column({
    type: 'bigint',
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  balance: number;

  // tiền tạm ứng
  @Column({
    name: 'advance_balance',
    type: 'bigint',
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  advanceBalance: number;

  // tổng tiền hiện tại
  @Column({
    name: 'total_balance',
    type: 'bigint',
    default: 0,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  totalBalance: number;

  @Column({ type: 'varchar', length: 10, default: 'VND' })
  currency: string;
}
