// src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler.ts
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ITicketOrderRepository } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TICKET_ORDER_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import type { ITicketRepository } from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import { TICKET_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import type { ITicketProductRepository } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TICKET_PRODUCT_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import type { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import { Ticket } from '@/modules/ticket/domain/models/ticket.aggregate';
import { TicketOrderStatusEnum, TicketUsageTypeEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
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
    @Inject(TICKET_PRODUCT_REPOSITORY)
    private readonly productRepo: ITicketProductRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(cmd: ConfirmTicketOrderPaymentCommand): Promise<ConfirmTicketOrderPaymentResult> {
    const order = await this.orderRepo.findById(cmd.ticketOrderId);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn vé');
    }

    if (cmd.merchantId && order.getMerchantId() !== cmd.merchantId) {
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
    const productCache = new Map<string, TicketProduct>();
    let concurrentlyClaimedResult: ConfirmTicketOrderPaymentResult | undefined;

    await this.dataSource.transaction(async (manager) => {
      // Chốt việc chuyển trạng thái PENDING -> PAID bằng conditional update. Đây là "cửa"
      // chống trùng lặp cho các lần gọi đồng thời (vd webhook gửi trùng): chỉ lệnh gọi nào
      // thực sự chuyển được trạng thái mới được phép trừ quota + issue vé.
      const claimed = await manager.update(
        TicketOrderOrmEntity,
        { uuid: order.id, status: TicketOrderStatusEnum.PENDING },
        { status: TicketOrderStatusEnum.PAID },
      );

      if (claimed.affected === 0) {
        // Một lệnh gọi đồng thời khác đã chốt đơn này trước — trả về vé đã issue (idempotent).
        const tickets = await this.ticketRepo.findByOrderId(order.id);
        concurrentlyClaimedResult = {
          orderId: order.id,
          tickets: tickets.map((t) => ({ code: t.getCode() })),
        };
        return;
      }

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

        let product = productCache.get(line.getTicketProductId());
        if (!product) {
          const found = await this.productRepo.findById(line.getTicketProductId());
          if (found) {
            product = found;
            productCache.set(line.getTicketProductId(), found);
          }
        }
        const usageRule = product?.getUsageRule();
        const remainingUses =
          usageRule?.type === TicketUsageTypeEnum.LIMITED_USE ? usageRule.maxUses ?? null : null;

        for (let i = 0; i < line.getQuantity(); i += 1) {
          issuedTickets.push(
            Ticket.issue({
              ticketOrderId: order.id,
              ticketProductId: line.getTicketProductId(),
              ticketSessionId: line.getTicketSessionId(),
              zoneId: line.getZoneId(),
              remainingUses,
            }),
          );
        }
      }

      await manager.save(TicketOrmEntity, issuedTickets.map((t) => TicketMapper.toOrm(t)));
    });

    if (concurrentlyClaimedResult) {
      return concurrentlyClaimedResult;
    }

    return { orderId: order.id, tickets: issuedTickets.map((t) => ({ code: t.getCode() })) };
  }
}
