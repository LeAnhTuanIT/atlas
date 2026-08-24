import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { IntegrationConnectionOrmEntity } from './integration-connection.orm-entity';

@Entity({ name: 'zbs_templates' })
@Index(['connectionId', 'templateId'], { unique: true })
export class ZbsTemplateOrmEntity extends BaseOrmEntity {
  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @ManyToOne(() => IntegrationConnectionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id', referencedColumnName: 'uuid' })
  // Typed `any` (not the concrete class) to avoid an emitDecoratorMetadata TDZ crash
  // on circular-imported ManyToOne/OneToOne relation properties.
  connection?: any;

  // null = draft cục bộ, chưa publish lên Zalo lần nào
  @Column({ name: 'template_id', type: 'varchar', length: 100, nullable: true })
  templateId: string | null;

  @Column({ name: 'template_name', type: 'varchar', length: 255 })
  templateName: string;

  @Column({ name: 'template_type', type: 'varchar', length: 20 })
  templateType: string;

  @Column({ type: 'varchar', length: 20 })
  tag: string;

  // Passthrough nguyên schema Zalo (header/body/footer) — xem ghi chú trong domain entity.
  @Column({ type: 'jsonb', default: {} })
  layout: Record<string, any>;

  @Column({ type: 'jsonb', default: [] })
  params: Array<{ type: string; name: string; sample_value: string }>;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({ name: 'tracking_id', type: 'varchar', length: 100, nullable: true })
  trackingId: string | null;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'synced_at', type: 'timestamptz', nullable: true })
  syncedAt: Date | null;
}
