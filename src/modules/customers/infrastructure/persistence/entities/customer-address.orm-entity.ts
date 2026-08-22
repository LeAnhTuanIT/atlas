import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
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
  merchant: MerchantOrmEntity;

  @Index()
  @Column({ name: 'customer_id', type: 'uuid', nullable: false })
  customerId: string;

  @ManyToOne(() => CustomerOrmEntity, (customer) => customer.addresses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customer_id', referencedColumnName: 'uuid' })
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
