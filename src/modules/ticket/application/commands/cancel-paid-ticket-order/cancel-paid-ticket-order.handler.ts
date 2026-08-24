import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ITicketOrderRepository } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TICKET_ORDER_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import type { ITicketRepository } from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import { TICKET_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import { TicketZoneOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-zone.orm-entity';
import { TicketOrderOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order.orm-entity';
import { TicketOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket.orm-entity';
import { CancelPaidTicketOrderCommand } from './cancel-paid-ticket-order.command';

@Injectable()
export class CancelPaidTicketOrderHandler {
  constructor(
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(cmd: CancelPaidTicketOrderCommand): Promise<void> {
    const order = await this.orderRepo.findById(cmd.ticketOrderId);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn vé');
    }

    // Ném lỗi trước khi mở transaction nếu order chưa PAID (đúng ngữ nghĩa domain).
    order.cancelPaidOrder();

    const tickets = await this.ticketRepo.findByOrderId(order.id);

    await this.dataSource.transaction(async (manager) => {
      for (const line of order.getLines()) {
        await manager
          .createQueryBuilder()
          .update(TicketZoneOrmEntity)
          .set({ quota: () => `quota + ${line.getQuantity()}` })
          .where('uuid = :zoneId', { zoneId: line.getZoneId() })
          .execute();
      }

      if (tickets.length) {
        await manager.update(
          TicketOrmEntity,
          { ticketOrderId: order.id },
          { status: 'CANCELLED' },
        );
      }

      await manager.update(TicketOrderOrmEntity, { uuid: order.id }, { status: order.getStatus() });
    });
  }
}
