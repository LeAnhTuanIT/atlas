import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { TicketProductOrmEntity } from './ticket-product.orm-entity';

@Entity({ name: 'ticket_sessions' })
export class TicketSessionOrmEntity extends BaseOrmEntity {
  @Column({ name: 'ticket_product_id', type: 'uuid' })
  ticketProductId: string;

  @ManyToOne(() => TicketProductOrmEntity, (p) => p.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_product_id', referencedColumnName: 'uuid' })
  // Typed via `Relation<T>` (not the concrete class directly) to avoid an
  // emitDecoratorMetadata TDZ crash on circular-imported ManyToOne/OneToOne relation
  // properties, while keeping full static typing.
  ticketProduct?: Relation<TicketProductOrmEntity>;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;
}
