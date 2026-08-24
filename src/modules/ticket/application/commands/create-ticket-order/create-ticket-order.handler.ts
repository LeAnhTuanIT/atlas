import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITicketProductRepository } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TICKET_PRODUCT_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import type { ITicketOrderRepository } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TICKET_ORDER_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TicketAvailabilityService } from '@/modules/ticket/infrastructure/redis/ticket-availability.service';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { PaymentGatewayFactory } from '@/modules/payment/infrastructure/gateways/payment-gateway.factory';
import { CreateTicketOrderCommand } from './create-ticket-order.command';

export interface CreateTicketOrderResult {
  orderId: string;
  status: string;
  totalAmount: number;
  paymentUrl?: string;
}

@Injectable()
export class CreateTicketOrderHandler {
  constructor(
    @Inject(TICKET_PRODUCT_REPOSITORY)
    private readonly productRepo: ITicketProductRepository,
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    private readonly availabilityService: TicketAvailabilityService,
    private readonly gatewayFactory: PaymentGatewayFactory,
  ) {}

  async execute(cmd: CreateTicketOrderCommand): Promise<CreateTicketOrderResult> {
    if (!cmd.lines.length) {
      throw new BadRequestException('Đơn vé phải có ít nhất 1 dòng vé');
    }

    const now = new Date();
    const orderLines: {
      ticketProductId: string;
      ticketSessionId: string;
      zoneId: string;
      quantity: number;
      unitPrice: number;
    }[] = [];
    const reservedForCompensation: { sessionId: string; zoneId: string; quantity: number }[] = [];

    let order: TicketOrder;
    let paymentUrl: string | undefined;

    try {
      for (const line of cmd.lines) {
        const product = await this.productRepo.findPublishedById(line.ticketProductId);
        if (!product) {
          throw new NotFoundException('Loại vé không khả dụng để bán');
        }

        const session = product.findSession(line.ticketSessionId);
        if (!session || !session.isActiveAt(now)) {
          throw new NotFoundException('Suất vé không còn hiệu lực');
        }

        const zone = product.findZone(line.zoneId);
        if (!zone) {
          throw new NotFoundException('Khu vực vé không tồn tại');
        }

        const reserved = await this.availabilityService.reserve(
          line.ticketSessionId,
          line.zoneId,
          line.quantity,
          zone.getQuota(),
        );
        if (!reserved) {
          throw new ConflictException('Không đủ vé còn lại');
        }
        reservedForCompensation.push({
          sessionId: line.ticketSessionId,
          zoneId: line.zoneId,
          quantity: line.quantity,
        });

        orderLines.push({
          ticketProductId: line.ticketProductId,
          ticketSessionId: line.ticketSessionId,
          zoneId: line.zoneId,
          quantity: line.quantity,
          unitPrice: product.getPriceAmount(),
        });
      }

      order = TicketOrder.create({
        merchantId: cmd.merchantId,
        channel: cmd.channel,
        buyerId: cmd.buyerId,
        lines: orderLines,
      });

      if (cmd.channel === TicketOrderChannelEnum.ONLINE) {
        if (!cmd.gateway || !cmd.returnUrl) {
          throw new BadRequestException('Đơn vé online phải chỉ định gateway và returnUrl');
        }
        const gatewayService = this.gatewayFactory.get(cmd.gateway);
        const result = await gatewayService.createPaymentUrl({
          orderCode: order.id,
          amount: order.getTotalAmount(),
          description: `Thanh toan don ve ${order.id}`,
          returnUrl: cmd.returnUrl,
        });
        paymentUrl = result.paymentUrl;
        order.attachPaymentOrderCode(order.id);
      }
    } catch (err) {
      for (const hold of reservedForCompensation) {
        await this.availabilityService.release(hold.sessionId, hold.zoneId, hold.quantity);
      }
      throw err;
    }

    await this.orderRepo.save(order);

    return {
      orderId: order.id,
      status: order.getStatus(),
      totalAmount: order.getTotalAmount(),
      paymentUrl,
    };
  }
}
