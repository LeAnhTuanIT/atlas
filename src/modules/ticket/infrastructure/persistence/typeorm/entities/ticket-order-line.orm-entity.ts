import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { TicketOrderOrmEntity } from './ticket-order.orm-entity';

@Entity({ name: 'ticket_order_lines' })
export class TicketOrderLineOrmEntity extends BaseOrmEntity {
  @Column({ name: 'ticket_order_id', type: 'uuid' })
  ticketOrderId: string;

  @ManyToOne(() => TicketOrderOrmEntity, (o) => o.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_order_id', referencedColumnName: 'uuid' })
  ticketOrder?: any;

  @Column({ name: 'ticket_product_id', type: 'uuid' })
  ticketProductId: string;

  @Column({ name: 'ticket_session_id', type: 'uuid' })
  ticketSessionId: string;

  @Column({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  unitPrice: number;
}
