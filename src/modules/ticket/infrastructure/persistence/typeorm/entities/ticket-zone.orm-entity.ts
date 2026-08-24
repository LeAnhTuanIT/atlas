import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { TicketProductOrmEntity } from './ticket-product.orm-entity';

@Entity({ name: 'ticket_zones' })
export class TicketZoneOrmEntity extends BaseOrmEntity {
  @Column({ name: 'ticket_product_id', type: 'uuid' })
  ticketProductId: string;

  @ManyToOne(() => TicketProductOrmEntity, (p) => p.zones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_product_id', referencedColumnName: 'uuid' })
  ticketProduct?: TicketProductOrmEntity;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int' })
  quota: number;
}
