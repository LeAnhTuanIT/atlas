import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationStatusEnum } from '@/modules/integrations/domain/value-objects/integration-status.vo';

@Entity({ name: 'integration_connections' })
@Index(['merchantId', 'provider'], { unique: true })
export class IntegrationConnectionOrmEntity extends BaseOrmEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  merchant?: MerchantOrmEntity;

  @Column({ type: 'enum', enum: IntegrationProviderEnum })
  provider: IntegrationProviderEnum;

  @Column({ name: 'external_id', type: 'varchar', length: 100 })
  externalId: string;

  @Column({
    type: 'enum',
    enum: IntegrationStatusEnum,
    default: IntegrationStatusEnum.ACTIVE,
  })
  status: IntegrationStatusEnum;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string | null;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}
