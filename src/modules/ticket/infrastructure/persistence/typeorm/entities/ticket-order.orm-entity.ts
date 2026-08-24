import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { TicketOrderLineOrmEntity } from './ticket-order-line.orm-entity';

@Entity({ name: 'ticket_orders' })
export class TicketOrderOrmEntity extends BaseOrmEntity {
  @Index()
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ type: 'varchar', length: 20 })
  channel: string;

  @Column({ name: 'buyer_id', type: 'uuid', nullable: true })
  buyerId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Index({ unique: true })
  @Column({ name: 'payment_order_code', type: 'varchar', length: 100, nullable: true })
  paymentOrderCode: string | null;

  @OneToMany(() => TicketOrderLineOrmEntity, (l) => l.ticketOrder, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  lines: TicketOrderLineOrmEntity[];
}
