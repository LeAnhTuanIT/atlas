import { Body, Controller, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerAuthGuard, MerchantAuthGuard } from '@/shared/infrastructure/auth/guards/auth-guards.guards';
import { CreateTicketOrderHandler } from '../../application/commands/create-ticket-order/create-ticket-order.handler';
import { CreateTicketOrderCommand } from '../../application/commands/create-ticket-order/create-ticket-order.command';
import { ConfirmTicketOrderPaymentHandler } from '../../application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler';
import { ConfirmTicketOrderPaymentCommand } from '../../application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.command';
import { CancelTicketOrderHandler } from '../../application/commands/cancel-ticket-order/cancel-ticket-order.handler';
import { CancelTicketOrderCommand } from '../../application/commands/cancel-ticket-order/cancel-ticket-order.command';
import { CancelPaidTicketOrderHandler } from '../../application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.handler';
import { CancelPaidTicketOrderCommand } from '../../application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.command';
import { CreateTicketOrderDto } from '../../application/dtos/create-ticket-order.dto';
import { TicketOrderChannelEnum } from '../../domain/value-objects/ticket-enums.vo';

interface CustomerRequest extends Request {
  user: { merchantId: string; sub: string };
}

interface MerchantRequest extends Request {
  user: { merchantId: string };
}

@Controller({ path: 'customer/tickets/orders', version: '1' })
@UseGuards(CustomerAuthGuard)
export class CustomerTicketOrderController {
  constructor(private readonly createOrderHandler: CreateTicketOrderHandler) {}

  @Post()
  async create(@Req() req: CustomerRequest, @Body() dto: CreateTicketOrderDto) {
    return this.createOrderHandler.execute(
      new CreateTicketOrderCommand(
        req.user.merchantId,
        TicketOrderChannelEnum.ONLINE,
        req.user.sub,
        dto.lines,
        dto.gateway,
        dto.returnUrl,
      ),
    );
  }
}

@Controller({ path: 'merchant/tickets/orders', version: '1' })
@UseGuards(MerchantAuthGuard)
export class MerchantTicketOrderController {
  constructor(
    private readonly createOrderHandler: CreateTicketOrderHandler,
    private readonly confirmPaymentHandler: ConfirmTicketOrderPaymentHandler,
    private readonly cancelOrderHandler: CancelTicketOrderHandler,
    private readonly cancelPaidOrderHandler: CancelPaidTicketOrderHandler,
  ) {}

  // Vé/đơn hàng là dữ liệu theo merchant — nếu JWT hợp lệ về scope nhưng thiếu
  // claim merchantId (token dị dạng), phải từ chối ngay thay vì âm thầm bỏ qua
  // bước kiểm tra quyền sở hữu đơn hàng ở tầng handler (fail closed, không fail open).
  private requireMerchantId(req: MerchantRequest): string {
    if (!req.user?.merchantId) {
      throw new UnauthorizedException('Token không có merchantId hợp lệ.');
    }
    return req.user.merchantId;
  }

  @Post()
  async createCounterOrder(@Req() req: MerchantRequest, @Body() dto: CreateTicketOrderDto) {
    const merchantId = this.requireMerchantId(req);
    return this.createOrderHandler.execute(
      new CreateTicketOrderCommand(
        merchantId,
        TicketOrderChannelEnum.COUNTER,
        undefined,
        dto.lines,
      ),
    );
  }

  @Post(':id/confirm-payment')
  async confirmCounterPayment(@Req() req: MerchantRequest, @Param('id') id: string) {
    const merchantId = this.requireMerchantId(req);
    return this.confirmPaymentHandler.execute(
      new ConfirmTicketOrderPaymentCommand(id, merchantId),
    );
  }

  @Post(':id/cancel')
  async cancelPendingOrder(@Req() req: MerchantRequest, @Param('id') id: string) {
    const merchantId = this.requireMerchantId(req);
    await this.cancelOrderHandler.execute(
      new CancelTicketOrderCommand(id, 'CANCELLED', merchantId),
    );
    return { id, status: 'CANCELLED' };
  }

  @Post(':id/refund')
  async cancelPaidOrder(@Req() req: MerchantRequest, @Param('id') id: string) {
    const merchantId = this.requireMerchantId(req);
    await this.cancelPaidOrderHandler.execute(
      new CancelPaidTicketOrderCommand(id, merchantId),
    );
    return { id, status: 'CANCELLED' };
  }
}
