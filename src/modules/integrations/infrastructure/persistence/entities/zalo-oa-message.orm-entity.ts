import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { ZaloOaMessageDirectionEnum } from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { IntegrationConnectionOrmEntity } from './integration-connection.orm-entity';

@Entity({ name: 'zalo_oa_messages' })
@Index(['connectionId', 'externalMessageId'])
export class ZaloOaMessageOrmEntity extends BaseOrmEntity {
  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @ManyToOne(() => IntegrationConnectionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id', referencedColumnName: 'uuid' })
  connection?: IntegrationConnectionOrmEntity;

  @Column({ type: 'enum', enum: ZaloOaMessageDirectionEnum })
  direction: ZaloOaMessageDirectionEnum;

  @Column({ name: 'zalo_user_id', type: 'varchar', length: 100 })
  zaloUserId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'message_type', type: 'varchar', length: 50 })
  messageType: string;

  @Column({
    name: 'external_message_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  externalMessageId: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;
}
