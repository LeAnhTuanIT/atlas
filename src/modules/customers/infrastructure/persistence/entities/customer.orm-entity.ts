// customer.orm-entity.ts
import {
  Entity,
  Column,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { CustomerAddressOrmEntity } from './customer-address.orm-entity';

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

@Entity({ name: 'customers' })
@Index(['merchantId', 'phone'], { unique: true })
@Index(['merchantId', 'email'], { unique: true })
export class CustomerOrmEntity extends BaseOrmEntity {
  @Index()
  @Column({ name: 'merchant_id', type: 'uuid', nullable: false })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, (merchant) => merchant.customers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  // Typed `any` (not the concrete class) to avoid an emitDecoratorMetadata TDZ crash
  // on circular-imported ManyToOne/OneToOne relation properties.
  merchant: any;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash?: string;

  @Column({
    type: 'enum',
    enum: CustomerStatus,
    default: CustomerStatus.ACTIVE,
  })
  status: CustomerStatus;

  @Column({ name: 'loyalty_points', type: 'int', default: 0 })
  loyaltyPoints: number;

  @OneToMany(() => CustomerAddressOrmEntity, (address) => address.customer)
  addresses: CustomerAddressOrmEntity[];
}
