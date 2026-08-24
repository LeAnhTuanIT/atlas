import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { ITicketRepository } from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import { Ticket } from '@/modules/ticket/domain/models/ticket.aggregate';
import { TicketOrmEntity } from './entities/ticket.orm-entity';
import { TicketMapper } from '../mappers/ticket.mapper';

@Injectable()
export class TicketTypeormRepository implements ITicketRepository {
  constructor(
    @InjectRepository(TicketOrmEntity)
    private readonly repo: Repository<TicketOrmEntity>,
  ) {}

  async findByOrderId(orderId: string): Promise<Ticket[]> {
    const orms = await this.repo.find({ where: { ticketOrderId: orderId } });
    return orms.map((orm) => TicketMapper.toDomain(orm));
  }

  async saveMany(tickets: Ticket[]): Promise<void> {
    if (!tickets.length) {
      return;
    }
    await this.repo.save(tickets.map((t) => TicketMapper.toOrm(t)));
  }
}
