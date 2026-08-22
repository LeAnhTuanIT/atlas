import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { CustomerOrmEntity } from './customer.orm-entity';

@Entity({ name: 'customer_addresses' })
export class CustomerAddressOrmEntity extends BaseOrmEntity {
  @Index()
  @Column({ name: 'customer_id', type: 'bigint', nullable: false })
  customerId: string;

  @ManyToOne(() => CustomerOrmEntity, (customer) => customer.addresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerOrmEntity;

  @Column({ name: 'receiver_name', type: 'varchar', length: 150 })
  receiverName: string;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'address_line', type: 'varchar', length: 255 })
  addressLine: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;
}
