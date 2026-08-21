import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('shop_feature_entitlements')
@Index(['shopId', 'featureId'], { unique: true })
@Index(['shopId', 'isActive', 'expiresAt'])
export class ShopEntitlementOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'shop_id', type: 'varchar', length: 50 })
  shopId: string;

  @Column({ name: 'feature_id', type: 'varchar', length: 50 })
  featureId: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'start_at', type: 'timestamp with time zone' })
  startAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp with time zone' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}