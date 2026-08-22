// src/modules/payment/presentation/controllers/payment-webhook.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProcessPaymentWebhookHandler } from '../../application/commands/process-payment-webhook.handler';
import { PaymentGatewayFactory } from '../../infrastructure/gateways/payment-gateway.factory';
import { PaymentGatewayEnum } from '../../domain/value-objects/payment-status.vo';

@Controller('public/webhooks/payment')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);
  private readonly frontendBaseUrl: string;

  constructor(
    private readonly webhookHandler: ProcessPaymentWebhookHandler,
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly configService: ConfigService,
  ) {
    this.frontendBaseUrl =
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3000/merchant/wallet/callback';
  }

  // ==========================================
  // VNPAY IPN (Dùng @Res({ passthrough: false }) res: Response)
  // ==========================================
  @Get('vnpay/ipn')
  async handleVnPayIpn(@Query() query: any, @Res() res: Response) {
    return this.processVnPayIpnLogic(query, res);
  }

  @Get('vnpay')
  async handleVnPayIpnFallback(@Query() query: any, @Res() res: Response) {
    return this.processVnPayIpnLogic(query, res);
  }

  private async processVnPayIpnLogic(query: any, res: Response) {
    try {
      const gateway = this.gatewayFactory.get(PaymentGatewayEnum.VNPAY);

      // 1. Kiểm tra chữ ký bảo mật
      const isValid = gateway.verifyWebhook({ ...query });
      if (!isValid) {
        this.logger.warn(`VNPAY IPN Checksum Failed: ${JSON.stringify(query)}`);
        // Gửi JSON phẳng trực tiếp qua res.status().json()
        return res.status(HttpStatus.OK).json({
          RspCode: '97',
          Message: 'Fail checksum',
        });
      }

      const orderId = query['vnp_TxnRef'];
      const vnpAmount = Number(query['vnp_Amount']) / 100;
      const responseCode = query['vnp_ResponseCode'];
      const transactionStatus = query['vnp_TransactionStatus'];

      // 2. Kiểm tra kết quả giao dịch
      if (
        responseCode === '00' &&
        (!transactionStatus || transactionStatus === '00')
      ) {
        const result = await this.webhookHandler.execute(orderId, vnpAmount);
        return res.status(HttpStatus.OK).json({
          RspCode: result.rspCode,
          Message: result.message,
        });
      }

      this.logger.log(
        `VNPAY Transaction failed: Order ${orderId}, Code ${responseCode}`,
      );
      return res.status(HttpStatus.OK).json({
        RspCode: '00',
        Message: 'Confirm Success',
      });
    } catch (error: any) {
      this.logger.error(`VNPAY IPN Process Error: ${error.message}`);
      return res.status(HttpStatus.OK).json({
        RspCode: '99',
        Message: 'Unknown error',
      });
    }
  }

  // ==========================================
  // VNPAY Return URL
  // ==========================================
  @Get('vnpay/return')
  handleVnPayReturn(@Query() query: any, @Res() res: Response) {
    const gateway = this.gatewayFactory.get(PaymentGatewayEnum.VNPAY);
    const isValid = gateway.verifyWebhook({ ...query });
    const isSuccess = isValid && query['vnp_ResponseCode'] === '00';
    const orderId = query['vnp_TxnRef'] || '';
    const amount = Number(query['vnp_Amount'] || 0) / 100;

    return res.redirect(
      `${this.frontendBaseUrl}?status=${isSuccess ? 'success' : 'failed'}&orderId=${orderId}&amount=${amount}&gateway=vnpay`,
    );
  }

  // ==========================================
  // PayOS Webhook
  // ==========================================
  @Post('payos')
  @HttpCode(HttpStatus.OK)
  async handlePayOsWebhook(@Body() body: any) {
    const gateway = this.gatewayFactory.get(PaymentGatewayEnum.PAYOS);
    if (!gateway.verifyWebhook(body)) {
      throw new UnauthorizedException('Chữ ký PayOS không hợp lệ');
    }

    if (body.code === '00' && body.data) {
      const { orderCode, amount } = body.data;
      await this.webhookHandler.execute(String(orderCode), Number(amount));
    }
    return { success: true };
  }

  // Hỗ trợ cả /momo/ipn và /momo fallback
  @Post('momo/ipn')
  @HttpCode(HttpStatus.NO_CONTENT)
  async handleMoMoIpn(@Body() body: any) {
    return this.processMoMoIpnLogic(body);
  }

  @Post('momo')
  @HttpCode(HttpStatus.NO_CONTENT)
  async handleMoMoIpnFallback(@Body() body: any) {
    return this.processMoMoIpnLogic(body);
  }

  private async processMoMoIpnLogic(body: any) {
    const gateway = this.gatewayFactory.get(PaymentGatewayEnum.MOMO);

    // 1. Xác thực chữ ký MoMo
    if (!gateway.verifyWebhook(body)) {
      this.logger.warn(`MoMo Checksum Failed: ${JSON.stringify(body)}`);
      throw new UnauthorizedException('Chữ ký MoMo không hợp lệ');
    }

    const { orderId, amount, resultCode } = body;

    // 2. Giao dịch thành công khi resultCode === 0
    if (Number(resultCode) === 0) {
      await this.webhookHandler.execute(String(orderId), Number(amount));
    } else {
      this.logger.log(
        `MoMo Payment Failed: Order ${orderId}, ResultCode: ${resultCode}`,
      );
    }

    // MoMo chấp nhận HTTP 204 No Content (hoặc status 200)
    return;
  }

  // Return URL: Trình duyệt user chuyển hướng về sau khi thanh toán MoMo
  @Get('momo/return')
  handleMoMoReturn(@Query() query: any, @Res() res: Response) {
    const gateway = this.gatewayFactory.get(PaymentGatewayEnum.MOMO);
    const isValid = gateway.verifyWebhook({ ...query });
    const isSuccess = isValid && Number(query['resultCode']) === 0;
    const orderId = query['orderId'] || '';
    const amount = Number(query['amount'] || 0);

    return res.redirect(
      `${this.frontendBaseUrl}?status=${isSuccess ? 'success' : 'failed'}&orderId=${orderId}&amount=${amount}&gateway=momo`,
    );
  }
}
