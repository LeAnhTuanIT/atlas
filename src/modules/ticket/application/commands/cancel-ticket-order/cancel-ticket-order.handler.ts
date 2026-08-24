import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITicketOrderRepository } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TICKET_ORDER_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TicketAvailabilityService } from '@/modules/ticket/infrastructure/redis/ticket-availability.service';
import { CancelTicketOrderCommand } from './cancel-ticket-order.command';

@Injectable()
export class CancelTicketOrderHandler {
  constructor(
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    private readonly availabilityService: TicketAvailabilityService,
  ) {}

  async execute(cmd: CancelTicketOrderCommand): Promise<void> {
    const order = await this.orderRepo.findById(cmd.ticketOrderId);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn vé');
    }

    if (cmd.finalStatus === 'EXPIRED') {
      order.markAsExpired();
    } else {
      order.markAsCancelled();
    }

    for (const line of order.getLines()) {
      await this.availabilityService.release(line.getTicketSessionId(), line.getZoneId(), line.getQuantity());
    }

    await this.orderRepo.save(order);
  }
}
