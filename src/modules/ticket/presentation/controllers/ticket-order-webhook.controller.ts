import { Controller, Get, Query, Res, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { PaymentGatewayFactory } from '@/modules/payment/infrastructure/gateways/payment-gateway.factory';
import { PaymentGatewayEnum } from '@/modules/payment/domain/value-objects/payment-status.vo';
import { ConfirmTicketOrderPaymentHandler } from '../../application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler';
import { ConfirmTicketOrderPaymentCommand } from '../../application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.command';
import { CancelTicketOrderHandler } from '../../application/commands/cancel-ticket-order/cancel-ticket-order.handler';
import { CancelTicketOrderCommand } from '../../application/commands/cancel-ticket-order/cancel-ticket-order.command';

@Controller('public/webhooks/ticket-payment')
export class TicketOrderWebhookController {
  private readonly logger = new Logger(TicketOrderWebhookController.name);

  constructor(
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly confirmHandler: ConfirmTicketOrderPaymentHandler,
    private readonly cancelHandler: CancelTicketOrderHandler,
  ) {}

  @Get('vnpay/ipn')
  async handleVnPayIpn(@Query() query: any, @Res() res: Response) {
    const gateway = this.gatewayFactory.get(PaymentGatewayEnum.VNPAY);
    const isValid = gateway.verifyWebhook({ ...query });
    if (!isValid) {
      this.logger.warn(`Ticket VNPAY IPN checksum failed: ${JSON.stringify(query)}`);
      return res.status(HttpStatus.OK).json({ RspCode: '97', Message: 'Fail checksum' });
    }

    const orderId = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const transactionStatus = query['vnp_TransactionStatus'];

    try {
      if (responseCode === '00' && (!transactionStatus || transactionStatus === '00')) {
        await this.confirmHandler.execute(new ConfirmTicketOrderPaymentCommand(orderId));
      } else {
        await this.cancelHandler.execute(new CancelTicketOrderCommand(orderId, 'CANCELLED'));
      }
      return res.status(HttpStatus.OK).json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (err) {
      this.logger.error(`Xử lý webhook thanh toán vé thất bại: ${(err as Error).message}`);
      return res.status(HttpStatus.OK).json({ RspCode: '99', Message: 'Unknown error' });
    }
  }
}
