import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { CustomerOrmEntity } from './customer.orm-entity';

@Entity({ name: 'customer_addresses' })
export class CustomerAddressOrmEntity extends BaseOrmEntity {
  // Denormalize merchant_id trực tiếp (không chỉ suy ra qua customer_id) để
  // mọi bảng đều lọc/scope theo tenant được bằng đúng 1 cột, không bắt buộc
  // phải join sang customers mới xác định được dữ liệu thuộc merchant nào.
  @Index()
  @Column({ name: 'merchant_id', type: 'uuid', nullable: false })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  // Typed via TypeORM's `Relation<T>` wrapper to avoid a TDZ crash: emitDecoratorMetadata
  // emits a synchronous design:type reference on a directly-class-typed property, which
  // throws "Cannot access 'MerchantOrmEntity' before initialization" under certain module
  // load orders. `Relation<T>` keeps full static typing while emitDecoratorMetadata sees
  // only `Object`. The lazy `() => MerchantOrmEntity` decorator thunk is unaffected.
  merchant: Relation<MerchantOrmEntity>;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid', nullable: false })
  customerId: string;

  @ManyToOne(() => CustomerOrmEntity, (customer) => customer.addresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id', referencedColumnName: 'uuid' })
  // Same TDZ issue as `merchant` above — typed via `Relation<T>` instead of the concrete class.
  customer: Relation<CustomerOrmEntity>;

  @Column({ name: 'receiver_name', type: 'varchar', length: 150 })
  receiverName: string;

  @Column({ name: 'phone', type: 'varchar', length: 20 })
  phone: string;

  @Column({ name: 'address_line', type: 'varchar', length: 255 })
  addressLine: string;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean;
}
