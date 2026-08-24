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

    if (cmd.merchantId && order.getMerchantId() !== cmd.merchantId) {
      throw new NotFoundException('Không tìm thấy đơn vé');
    }

    // Chỉ nhả lại quota Redis nếu order thực sự đang PENDING và transition này thực sự xảy ra.
    // markAsCancelled()/markAsExpired() đã idempotent (silently no-op nếu đã ở trạng thái cuối),
    // nhưng nếu không chặn ở đây thì một lệnh gọi lặp lại (vd webhook trùng, cron expiry chồng
    // lấn) vẫn sẽ chạy lại vòng lặp release() bên dưới, nhả lại quota đã được nhả trước đó.
    const wasPending = order.isPending();

    if (cmd.finalStatus === 'EXPIRED') {
      order.markAsExpired();
    } else {
      order.markAsCancelled();
    }

    if (wasPending) {
      for (const line of order.getLines()) {
        await this.availabilityService.release(line.getTicketSessionId(), line.getZoneId(), line.getQuantity());
      }
    }

    await this.orderRepo.save(order);
  }
}
