// src/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { MerchantStatus } from '@/modules/merchant/domain/models/merchant.aggregate';
import { MerchantUserOrmEntity } from './merchant-user.orm-entity';
import { CustomerOrmEntity } from '@/modules/customers/infrastructure/persistence/entities/customer.orm-entity';

export { MerchantStatus };

@Entity({ name: 'merchants' })
export class MerchantOrmEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'uuid', unique: true })
  uuid: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: MerchantStatus,
    default: MerchantStatus.ACTIVE,
  })
  status: MerchantStatus;

  @Column({ type: 'jsonb', nullable: true, default: {} })
  settings: Record<string, any>;

  @OneToMany(() => MerchantUserOrmEntity, (user) => user.merchant)
  merchantUsers: MerchantUserOrmEntity[];

  @OneToMany(() => CustomerOrmEntity, (customer) => customer.merchant)
  customers: CustomerOrmEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}