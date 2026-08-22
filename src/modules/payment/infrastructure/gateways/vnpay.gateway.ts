// src/modules/payment/infrastructure/gateways/vnpay.gateway.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as querystring from 'qs';
import { format } from 'date-fns';
import {
  IPaymentGateway,
  CreatePaymentParams,
} from '../../domain/services/payment-gateway.interface';
import { PaymentGatewayEnum } from '../../domain/value-objects/payment-status.vo';

@Injectable()
export class VnPayGateway implements IPaymentGateway {
  constructor(private readonly configService: ConfigService) {}

  getGatewayType(): PaymentGatewayEnum {
    return PaymentGatewayEnum.VNPAY;
  }

  createPaymentUrl(
    params: CreatePaymentParams,
  ): Promise<{ paymentUrl: string; qrCode?: string }> {
    const tmnCode = (
      this.configService.get<string>('VNPAY_TMN_CODE') || 'FNHQJMAZ'
    ).trim();
    const secretKey = (
      this.configService.get<string>('VNPAY_HASH_SECRET') ||
      'DIJXFZIWSUPLVBUJVTSVUVJAPYJMUTEW'
    ).trim();
    const vnpUrl = (
      this.configService.get<string>('VNPAY_URL') ||
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
    ).trim();
    const returnUrl = (
      this.configService.get<string>('VNPAY_RETURN_URL') || params.returnUrl
    ).trim();

    const date = new Date();
    const createDate = format(date, 'yyyyMMddHHmmss');

    const vnpAmount = Math.round(Number(params.amount) * 100);

    const rawRef = String(
      (params as any).orderCode || (params as any).orderId || Date.now(),
    );
    const orderRef =
      rawRef.replace(/[^a-zA-Z0-9]/g, '').slice(0, 50) || `${Date.now()}`;

    const rawInfo = String(params.description || 'Thanh toan don hang');
    const orderInfo = rawInfo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .trim()
      .slice(0, 255);

    let ipAddr = (params as any).ipAddr || '127.0.0.1';
    if (
      typeof ipAddr !== 'string' ||
      ipAddr === '::1' ||
      ipAddr.includes(':') ||
      ipAddr.startsWith('http')
    ) {
      ipAddr = '127.0.0.1';
    }

    let vnpParams: Record<string, any> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderRef,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: vnpAmount,
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    vnpParams = this.sortObject(vnpParams);

    const signData = querystring.stringify(vnpParams, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    vnpParams['vnp_SecureHash'] = signed;

    const paymentUrl = `${vnpUrl}?${querystring.stringify(vnpParams, { encode: false })}`;

    return Promise.resolve({
      paymentUrl,
      qrCode: undefined,
    });
  }

  verifyWebhook(payload: any, signature?: string): boolean {
    const secretKey = (
      this.configService.get<string>('VNPAY_HASH_SECRET') ||
      'DIJXFZIWSUPLVBUJVTSVUVJAPYJMUTEW'
    ).trim();
    const secureHash = signature || payload['vnp_SecureHash'];

    if (!secureHash) return false;

    const vnpParams = { ...payload };
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnpParams);
    const signData = querystring.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return secureHash === signed;
  }

  private sortObject(obj: Record<string, any>): Record<string, any> {
    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).map(encodeURIComponent).sort();

    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
      }
    }

    return sorted;
  }
}
