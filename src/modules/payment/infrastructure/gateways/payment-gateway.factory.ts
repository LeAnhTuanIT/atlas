// src/modules/payment/infrastructure/gateways/payment-gateway.factory.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { IPaymentGateway } from '../../domain/services/payment-gateway.interface';
import { PaymentGatewayEnum } from '../../domain/value-objects/payment-status.vo';
import { PayosGateway } from './payos.gateway';
import { VnPayGateway } from './vnpay.gateway';
import { MoMoGateway } from './momo.gateway';

@Injectable()
export class PaymentGatewayFactory {
  private readonly gatewayMap = new Map<PaymentGatewayEnum, IPaymentGateway>();

  constructor(
    payosGateway: PayosGateway,
    vnpayGateway: VnPayGateway,
    momoGateway: MoMoGateway,
  ) {
    this.gatewayMap.set(PaymentGatewayEnum.PAYOS, payosGateway);
    this.gatewayMap.set(PaymentGatewayEnum.VNPAY, vnpayGateway);
    this.gatewayMap.set(PaymentGatewayEnum.MOMO, momoGateway);
  }

  get(gateway: PaymentGatewayEnum): IPaymentGateway {
    const service = this.gatewayMap.get(gateway);
    if (!service) {
      throw new BadRequestException(
        `Cổng thanh toán [${gateway}] không được hỗ trợ`,
      );
    }
    return service;
  }
}
