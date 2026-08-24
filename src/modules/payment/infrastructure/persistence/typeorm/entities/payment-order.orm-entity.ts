// src/modules/payment/infrastructure/persistence/typeorm/entities/payment-order.orm-entity.ts
import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import {
  PaymentGatewayEnum,
  PaymentStatusEnum,
} from '../../../../domain/value-objects/payment-status.vo';

@Entity('payment_orders')
export class PaymentOrderOrmEntity extends BaseOrmEntity {
  // orderCode là mã nghiệp vụ (business key) do gateway thanh toán biết tới,
  // KHÔNG phải khóa chính — khóa chính là `id`/`uuid` kế thừa từ BaseOrmEntity.
  @Index({ unique: true })
  @Column({ name: 'order_code', type: 'varchar', length: 100 })
  orderCode: string;

  @Index()
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  // Typed `any` (not the concrete class) to avoid an emitDecoratorMetadata TDZ crash
  // on circular-imported ManyToOne/OneToOne relation properties.
  merchant: any;

  @Column({
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  amount: number;

  @Column({ type: 'enum', enum: PaymentGatewayEnum })
  gateway: PaymentGatewayEnum;

  @Column({
    type: 'enum',
    enum: PaymentStatusEnum,
    default: PaymentStatusEnum.PENDING,
  })
  status: PaymentStatusEnum;

  @Column({ name: 'payment_url', type: 'text', nullable: true })
  paymentUrl: string;

  @Column({ name: 'paid_at', type: 'timestamp with time zone', nullable: true })
  paidAt: Date;
}
