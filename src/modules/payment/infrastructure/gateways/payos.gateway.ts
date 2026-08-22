// src/modules/payment/infrastructure/gateways/payos.gateway.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentGateway,
  CreatePaymentParams,
} from '../../domain/services/payment-gateway.interface';
import { PaymentGatewayEnum } from '../../domain/value-objects/payment-status.vo';
import * as crypto from 'crypto';

@Injectable()
export class PayosGateway implements IPaymentGateway {
  private readonly logger = new Logger(PayosGateway.name);
  private readonly checksumKey =
    process.env.PAYOS_CHECKSUM_KEY || 'payos_checksum_key';

  getGatewayType(): PaymentGatewayEnum {
    return PaymentGatewayEnum.PAYOS;
  }

  createPaymentUrl(
    params: CreatePaymentParams,
  ): Promise<{ paymentUrl: string; qrCode?: string }> {
    // PayOS OrderCode bắt buộc là số nguyên dương an toàn <= 9007199254740991
    const numericOrderCode = Number(params.orderCode.slice(-9)); // Lấy 9 số cuối của timestamp

    // Thực tế gọi: payOS.createPaymentLink({ orderCode: numericOrderCode, amount: params.amount, ... })
    const paymentUrl = `https://pay.payos.vn/web/${numericOrderCode}`;
    return Promise.resolve({ paymentUrl });
  }

  verifyWebhook(payload: any, _signature?: string): boolean {
    try {
      const data = payload.data;
      if (!data) return false;

      // Sắp xếp key theo alphabet để tạo chuỗi hash
      const sortedKeys = Object.keys(data).sort();
      const signString = sortedKeys
        .map((key) => `${key}=${data[key]}`)
        .join('&');

      const computedSignature = crypto
        .createHmac('sha256', this.checksumKey)
        .update(signString)
        .digest('hex');

      return computedSignature === payload.signature;
    } catch {
      return false;
    }
  }
}
