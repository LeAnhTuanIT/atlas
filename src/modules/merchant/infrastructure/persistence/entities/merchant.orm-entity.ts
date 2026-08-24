// src/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity.ts
import { Entity, Column, OneToMany, OneToOne } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantStatus } from '@/modules/merchant/domain/models/merchant.aggregate';
import { MerchantUserOrmEntity } from './merchant-user.orm-entity';
import { CustomerOrmEntity } from '@/modules/customers/infrastructure/persistence/entities/customer.orm-entity';
import { WalletOrmEntity } from '@/modules/wallet/infrastructure/persistence/typeorm/entities/wallet.orm-entity';

export { MerchantStatus };

@Entity({ name: 'merchants' })
export class MerchantOrmEntity extends BaseOrmEntity {
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: MerchantStatus,
    default: MerchantStatus.ACTIVE,
  })
  status: MerchantStatus;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  settings: Record<string, any>;

  @OneToMany(() => MerchantUserOrmEntity, (user) => user.merchant)
  merchantUsers: MerchantUserOrmEntity[];

  @OneToMany(() => CustomerOrmEntity, (customer) => customer.merchant)
  customers: CustomerOrmEntity[];

  // Chiều nghịch của quan hệ 1-1 — inverse side, không sở hữu cột FK.
  // Typed `any` (not the concrete class) to avoid an emitDecoratorMetadata TDZ crash
  // on circular-imported ManyToOne/OneToOne relation properties.
  @OneToOne(() => WalletOrmEntity, (wallet) => wallet.merchant)
  wallet?: any;
}
