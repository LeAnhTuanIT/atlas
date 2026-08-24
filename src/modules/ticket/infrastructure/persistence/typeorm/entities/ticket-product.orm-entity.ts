import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { TicketZoneOrmEntity } from './ticket-zone.orm-entity';
import { TicketSessionOrmEntity } from './ticket-session.orm-entity';

@Entity({ name: 'ticket_products' })
export class TicketProductOrmEntity extends BaseOrmEntity {
  @Index()
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  // Typed `any` (not the concrete class) to avoid an emitDecoratorMetadata TDZ crash
  // on circular-imported ManyToOne/OneToOne relation properties.
  merchant?: any;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'price_amount',
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  priceAmount: number;

  @Column({ name: 'price_currency', type: 'varchar', length: 3, default: 'VND' })
  priceCurrency: string;

  @Column({ name: 'validity_type', type: 'varchar', length: 20 })
  validityType: string;

  @Column({ name: 'usage_type', type: 'varchar', length: 20 })
  usageType: string;

  @Column({ name: 'usage_max_uses', type: 'int', nullable: true })
  usageMaxUses: number | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string;

  @OneToMany(() => TicketZoneOrmEntity, (z) => z.ticketProduct, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  zones: TicketZoneOrmEntity[];

  @OneToMany(() => TicketSessionOrmEntity, (s) => s.ticketProduct, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  sessions: TicketSessionOrmEntity[];
}
