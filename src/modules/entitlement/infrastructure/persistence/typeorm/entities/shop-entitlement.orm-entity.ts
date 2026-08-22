import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { FeatureOrmEntity } from './feature.orm-entity';

// Associative entity của quan hệ many-to-many Merchant <-> Feature.
// Không dùng @ManyToMany trực tiếp vì quan hệ này mang thuộc tính nghiệp vụ
// riêng (isActive, startAt, expiresAt) — @ManyToMany sẽ ẩn các cột này đi.
@Entity('shop_feature_entitlements')
@Index(['merchantId', 'featureId'], { unique: true })
@Index(['merchantId', 'isActive', 'expiresAt'])
export class ShopEntitlementOrmEntity extends BaseOrmEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  merchant: MerchantOrmEntity;

  @Column({ name: 'feature_id', type: 'uuid' })
  featureId: string;

  @ManyToOne(() => FeatureOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'feature_id', referencedColumnName: 'uuid' })
  feature: FeatureOrmEntity;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'start_at', type: 'timestamp with time zone' })
  startAt: Date;

  @Column({ name: 'expires_at', type: 'timestamp with time zone' })
  expiresAt: Date;
}
