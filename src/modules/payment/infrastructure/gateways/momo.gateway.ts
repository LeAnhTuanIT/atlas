// src/modules/payment/infrastructure/gateways/momo.gateway.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import axios from 'axios';
import {
  IPaymentGateway,
  CreatePaymentParams,
} from '../../domain/services/payment-gateway.interface';
import { PaymentGatewayEnum } from '../../domain/value-objects/payment-status.vo';

@Injectable()
export class MoMoGateway implements IPaymentGateway {
  private readonly logger = new Logger(MoMoGateway.name);

  constructor(private readonly configService: ConfigService) {}

  getGatewayType(): PaymentGatewayEnum {
    return PaymentGatewayEnum.MOMO;
  }

  async createPaymentUrl(
    params: CreatePaymentParams,
  ): Promise<{ paymentUrl: string; qrCode?: string }> {
    const partnerCode = (
      this.configService.get<string>('MOMO_PARTNER_CODE') || 'MOMO'
    ).trim();
    const accessKey = (
      this.configService.getOrThrow<string>('MOMO_ACCESS_KEY')
    ).trim();
    const secretKey = (
      this.configService.getOrThrow<string>('MOMO_SECRET_KEY')
    ).trim();
    const endpoint = (
      this.configService.getOrThrow<string>('MOMO_API_ENDPOINT')
    ).trim();

    const orderId = String(
      (params as any).orderCode || (params as any).orderId || Date.now(),
    ).trim();
    const requestId = `${orderId}_${Date.now()}`;
    const amount = String(Math.round(Number(params.amount)));
    const orderInfo = String(params.description || 'pay with MoMo').slice(
      0,
      255,
    );

    // Ưu tiên đọc biến môi trường từ .env
    const redirectUrl = (
      this.configService.get<string>('MOMO_RETURN_URL') || params.returnUrl
    ).trim();
    const ipnUrl = (
      this.configService.get<string>('MOMO_NOTIFY_URL') ||
      'https://trivially-suitable-vulture.ngrok-free.app/api/v1/public/webhooks/payment/momo/ipn'
    ).trim();

    const requestType = 'captureWallet';
    const extraData = '';

    // Thứ tự ghép chuỗi chữ ký chuẩn MoMo v2
    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&ipnUrl=${ipnUrl}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&partnerCode=${partnerCode}` +
      `&redirectUrl=${redirectUrl}` +
      `&requestId=${requestId}` +
      `&requestType=${requestType}`;

    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const requestBody = {
      partnerCode,
      accessKey,
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      extraData,
      requestType,
      signature,
      lang: 'vi',
    };

    try {
      const response = await axios.post(endpoint, requestBody, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data && response.data.resultCode === 0) {
        return {
          paymentUrl: response.data.payUrl,
          qrCode: response.data.qrCodeUrl,
        };
      }

      this.logger.error(
        `MoMo API rejected (${response.data?.resultCode}): ${response.data?.message}`,
      );

      return {
        paymentUrl:
          response.data?.payUrl || response.data?.shortLink || endpoint,
        qrCode: response.data?.qrCodeUrl,
      };
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        JSON.stringify(error?.response?.data) ||
        error?.message;
      this.logger.error(`Lỗi gọi MoMo Gateway: ${errorMsg}`);
      throw error;
    }
  }

  verifyWebhook(payload: any, signature?: string): boolean {
    const secretKey = (
      this.configService.get<string>('MOMO_SECRET_KEY') ||
      'K951B6PE1waDMi640xX08PD3vg6EkVlz'
    ).trim();
    const accessKey = (
      this.configService.get<string>('MOMO_ACCESS_KEY') || 'F8BBA842ECF85'
    ).trim();

    const {
      partnerCode,
      orderId,
      requestId,
      amount,
      orderInfo,
      orderType,
      transId,
      resultCode,
      message,
      payType,
      responseTime,
      extraData,
    } = payload;

    const rawSignature = [
      `accessKey=${accessKey}`,
      `amount=${amount}`,
      `extraData=${extraData || ''}`,
      `message=${message}`,
      `orderId=${orderId}`,
      `orderInfo=${orderInfo}`,
      `orderType=${orderType}`,
      `partnerCode=${partnerCode}`,
      `payType=${payType}`,
      `requestId=${requestId}`,
      `responseTime=${responseTime}`,
      `resultCode=${resultCode}`,
      `transId=${transId}`,
    ].join('&');

    const calculatedSignature = crypto
      .createHmac('sha256', secretKey)
      .update(rawSignature)
      .digest('hex');

    const incomingSignature = signature || payload.signature;
    return calculatedSignature === incomingSignature;
  }
}
