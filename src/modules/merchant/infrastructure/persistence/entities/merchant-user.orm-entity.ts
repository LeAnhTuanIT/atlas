import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
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
  // Typed via TypeORM's `Relation<T>` wrapper (not `MerchantOrmEntity` directly) to avoid
  // a TDZ crash: emitDecoratorMetadata emits a synchronous design:type reference on a
  // directly-class-typed property, which throws "Cannot access 'MerchantOrmEntity' before
  // initialization" when this file and merchant.orm-entity.ts import each other.
  // `Relation<T>` is a type-only alias (`= T`) built into TypeORM specifically for this —
  // it keeps full static typing while emitDecoratorMetadata sees only `Object`, not the
  // concrete class. The lazy `() => MerchantOrmEntity` decorator thunk is unaffected.
  merchant: Relation<MerchantOrmEntity>;

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
