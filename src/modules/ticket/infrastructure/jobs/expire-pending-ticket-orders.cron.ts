import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { ITicketOrderRepository } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TICKET_ORDER_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { CancelTicketOrderHandler } from '@/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.handler';
import { CancelTicketOrderCommand } from '@/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.command';

const PENDING_ORDER_TTL_MINUTES = 10;

@Injectable()
export class ExpirePendingTicketOrdersCron {
  private readonly logger = new Logger(ExpirePendingTicketOrdersCron.name);

  constructor(
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    private readonly cancelHandler: CancelTicketOrderHandler,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handle(): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_MINUTES * 60 * 1000);
    const expiredOrders = await this.orderRepo.findExpiredPending(cutoff);

    for (const order of expiredOrders) {
      try {
        await this.cancelHandler.execute(new CancelTicketOrderCommand(order.id, 'EXPIRED'));
      } catch (err) {
        this.logger.error(`Không thể expire đơn vé ${order.id}: ${(err as Error).message}`);
      }
    }
  }
}
