import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { ITicketProductRepository } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import { TicketProductStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketProductOrmEntity } from './entities/ticket-product.orm-entity';
import { TicketProductMapper } from '../mappers/ticket-product.mapper';

@Injectable()
export class TicketProductTypeormRepository implements ITicketProductRepository {
  constructor(
    @InjectRepository(TicketProductOrmEntity)
    private readonly repo: Repository<TicketProductOrmEntity>,
  ) {}

  async findById(id: string): Promise<TicketProduct | null> {
    const orm = await this.repo.findOne({
      where: { uuid: id },
      relations: { zones: true, sessions: true },
    });
    return orm ? TicketProductMapper.toDomain(orm) : null;
  }

  async findPublishedById(id: string): Promise<TicketProduct | null> {
    const orm = await this.repo.findOne({
      where: { uuid: id, status: TicketProductStatusEnum.PUBLISHED },
      relations: { zones: true, sessions: true },
    });
    return orm ? TicketProductMapper.toDomain(orm) : null;
  }

  async save(product: TicketProduct): Promise<void> {
    const orm = TicketProductMapper.toOrm(product);

    const existing = await this.repo.findOne({
      where: { uuid: orm.uuid },
      relations: { zones: true, sessions: true },
    });
    if (existing) {
      orm.id = existing.id;
      for (const zoneOrm of orm.zones) {
        const existingZone = existing.zones.find((z) => z.uuid === zoneOrm.uuid);
        if (existingZone) {
          zoneOrm.id = existingZone.id;
        }
      }
      for (const sessionOrm of orm.sessions) {
        const existingSession = existing.sessions.find((s) => s.uuid === sessionOrm.uuid);
        if (existingSession) {
          sessionOrm.id = existingSession.id;
        }
      }
    }

    await this.repo.save(orm);
  }
}
