import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from './merchant.orm-entity';

export enum MerchantUserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
}

@Entity({ name: 'merchant_users' })
@Index(['merchantId', 'email'], { unique: true })
export class MerchantUserOrmEntity extends BaseOrmEntity {
  @Index()
  @Column({ name: 'merchant_id', type: 'uuid', nullable: false })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, (merchant) => merchant.merchantUsers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  merchant: MerchantOrmEntity;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
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
}
