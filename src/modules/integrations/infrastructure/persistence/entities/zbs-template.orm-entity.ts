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
  connection?: IntegrationConnectionOrmEntity;

  @Column({ name: 'template_id', type: 'varchar', length: 100 })
  templateId: string;

  @Column({ name: 'template_name', type: 'varchar', length: 255 })
  templateName: string;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @Column({ name: 'synced_at', type: 'timestamptz' })
  syncedAt: Date;
}
