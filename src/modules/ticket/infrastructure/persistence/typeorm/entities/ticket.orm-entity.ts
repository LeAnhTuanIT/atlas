import { Entity, Column, Index } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';

@Entity({ name: 'tickets' })
export class TicketOrmEntity extends BaseOrmEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Index()
  @Column({ name: 'ticket_order_id', type: 'uuid' })
  ticketOrderId: string;

  @Column({ name: 'ticket_product_id', type: 'uuid' })
  ticketProductId: string;

  @Column({ name: 'ticket_session_id', type: 'uuid' })
  ticketSessionId: string;

  @Column({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  @Column({ type: 'varchar', length: 20, default: 'ISSUED' })
  status: string;

  @Column({ name: 'remaining_uses', type: 'int', nullable: true })
  remainingUses: number | null;
}
