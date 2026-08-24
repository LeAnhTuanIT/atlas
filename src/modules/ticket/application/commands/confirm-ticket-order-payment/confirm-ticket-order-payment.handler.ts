// src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler.ts
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ITicketOrderRepository } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TICKET_ORDER_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import type { ITicketRepository } from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import { TICKET_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import { Ticket } from '@/modules/ticket/domain/models/ticket.aggregate';
import { TicketOrderStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrderOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order.orm-entity';
import { TicketZoneOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-zone.orm-entity';
import { TicketOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket.orm-entity';
import { TicketMapper } from '@/modules/ticket/infrastructure/persistence/mappers/ticket.mapper';
import { ConfirmTicketOrderPaymentCommand } from './confirm-ticket-order-payment.command';

export interface ConfirmTicketOrderPaymentResult {
  orderId: string;
  tickets: { code: string }[];
}

@Injectable()
export class ConfirmTicketOrderPaymentHandler {
  constructor(
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(cmd: ConfirmTicketOrderPaymentCommand): Promise<ConfirmTicketOrderPaymentResult> {
    const order = await this.orderRepo.findById(cmd.ticketOrderId);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn vé');
    }

    if (order.getStatus() === TicketOrderStatusEnum.PAID) {
      const tickets = await this.ticketRepo.findByOrderId(order.id);
      return { orderId: order.id, tickets: tickets.map((t) => ({ code: t.getCode() })) };
    }

    if (order.getStatus() !== TicketOrderStatusEnum.PENDING) {
      throw new BadRequestException('Đơn vé không ở trạng thái chờ thanh toán');
    }

    const issuedTickets: Ticket[] = [];

    await this.dataSource.transaction(async (manager) => {
      for (const line of order.getLines()) {
        const updateResult = await manager
          .createQueryBuilder()
          .update(TicketZoneOrmEntity)
          .set({ quota: () => `quota - ${line.getQuantity()}` })
          .where('uuid = :zoneId AND quota >= :qty', {
            zoneId: line.getZoneId(),
            qty: line.getQuantity(),
          })
          .execute();

        if (updateResult.affected === 0) {
          throw new ConflictException(
            `Không đủ vé còn lại cho zone ${line.getZoneId()} tại thời điểm xác nhận thanh toán`,
          );
        }

        for (let i = 0; i < line.getQuantity(); i += 1) {
          issuedTickets.push(
            Ticket.issue({
              ticketOrderId: order.id,
              ticketProductId: line.getTicketProductId(),
              ticketSessionId: line.getTicketSessionId(),
              zoneId: line.getZoneId(),
              remainingUses: null,
            }),
          );
        }
      }

      await manager.save(TicketOrmEntity, issuedTickets.map((t) => TicketMapper.toOrm(t)));

      order.markAsPaid();
      await manager.update(
        TicketOrderOrmEntity,
        { uuid: order.id },
        { status: order.getStatus() },
      );
    });

    return { orderId: order.id, tickets: issuedTickets.map((t) => ({ code: t.getCode() })) };
  }
}
