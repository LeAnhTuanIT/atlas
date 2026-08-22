// src/modules/payment/infrastructure/persistence/typeorm/payment-order.typeorm.repository.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { IPaymentOrderRepository } from '../../../domain/repositories/payment-order.repository.interface';
import { PaymentOrder } from '../../../domain/models/payment-order.aggregate';
import { PaymentOrderOrmEntity } from './entities/payment-order.orm-entity';
import { PaymentOrderMapper } from '../../mappers/payment-order.mapper';

@Injectable()
export class PaymentOrderTypeormRepository implements IPaymentOrderRepository {
  constructor(
    @InjectRepository(PaymentOrderOrmEntity)
    private readonly repo: Repository<PaymentOrderOrmEntity>,
  ) {}

  async findByOrderCode(orderCode: string): Promise<PaymentOrder | null> {
    const orm = await this.repo.findOne({ where: { orderCode } });
    return orm ? PaymentOrderMapper.toDomain(orm) : null;
  }

  async save(order: PaymentOrder): Promise<void> {
    const orm = PaymentOrderMapper.toOrm(order);
    // `orderCode` là mã nghiệp vụ, không còn là PK — phải tra `id` (PK nội bộ)
    // của bản ghi đã tồn tại trước, nếu không TypeORM sẽ INSERT trùng thay vì UPDATE.
    const existing = await this.repo.findOne({
      where: { orderCode: orm.orderCode },
      select: { id: true },
    });
    if (existing) {
      orm.id = existing.id;
    }
    await this.repo.save(orm);
  }
}
