import { Injectable } from '@nestjs/common';
import { LessThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { ITicketOrderRepository } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrderOrmEntity } from './entities/ticket-order.orm-entity';
import { TicketOrderMapper } from '../mappers/ticket-order.mapper';

@Injectable()
export class TicketOrderTypeormRepository implements ITicketOrderRepository {
  constructor(
    @InjectRepository(TicketOrderOrmEntity)
    private readonly repo: Repository<TicketOrderOrmEntity>,
  ) {}

  async findById(id: string): Promise<TicketOrder | null> {
    const orm = await this.repo.findOne({ where: { uuid: id }, relations: { lines: true } });
    return orm ? TicketOrderMapper.toDomain(orm) : null;
  }

  async findExpiredPending(olderThan: Date): Promise<TicketOrder[]> {
    const orms = await this.repo.find({
      where: { status: TicketOrderStatusEnum.PENDING, createdAt: LessThan(olderThan) },
      relations: { lines: true },
    });
    return orms.map((orm) => TicketOrderMapper.toDomain(orm));
  }

  async save(order: TicketOrder): Promise<void> {
    const orm = TicketOrderMapper.toOrm(order);

    const existing = await this.repo.findOne({
      where: { uuid: orm.uuid },
      relations: { lines: true },
    });
    if (existing) {
      orm.id = existing.id;
      for (const lineOrm of orm.lines) {
        const existingLine = existing.lines.find((l) => l.uuid === lineOrm.uuid);
        if (existingLine) {
          lineOrm.id = existingLine.id;
        }
      }
    }

    await this.repo.save(orm);
  }
}
