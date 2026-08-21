import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from './merchant.orm-entity';
import { CustomerOrmEntity } from '@/modules/customers/infrastructure/persistence/entities/customer.orm-entity';

export enum MerchantUserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

@Entity({ name: 'merchant_users' })
@Index(['merchantId', 'email'], { unique: true })
export class MerchantUserOrmEntity extends BaseOrmEntity {
  @Index()
  @Column({ name: 'merchant_id', type: 'bigint', nullable: false })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, (merchant) => merchant.merchantUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: MerchantOrmEntity;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Column({
    type: 'enum',
    enum: MerchantUserRole,
    default: MerchantUserRole.OWNER,
  })
  role: MerchantUserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  // Thêm quan hệ merchantUsers
  @OneToMany(() => MerchantUserOrmEntity, (user) => user.merchant)
  merchantUsers: MerchantUserOrmEntity[];

  // Thêm quan hệ customers
  @OneToMany(() => CustomerOrmEntity, (customer) => customer.merchant)
  customers: CustomerOrmEntity[];
}