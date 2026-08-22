import { PaymentGatewayEnum } from '../value-objects/payment-status.vo';

export interface CreatePaymentParams {
  orderCode: string;
  amount: number;
  description: string;
  returnUrl: string;
  ipAddr?: string;
}

export interface IPaymentGateway {
  getGatewayType(): PaymentGatewayEnum;
  createPaymentUrl(
    params: CreatePaymentParams,
  ): Promise<{ paymentUrl: string; qrCode?: string }>;
  verifyWebhook(payload: any, signature?: string): boolean;
}
