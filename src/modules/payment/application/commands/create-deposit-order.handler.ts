// src/modules/payment/application/commands/create-deposit-order.handler.ts
import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { PAYMENT_ORDER_REPOSITORY } from '../../domain/repositories/payment-order.repository.interface';
import type { IPaymentOrderRepository } from '../../domain/repositories/payment-order.repository.interface';
import { PaymentGatewayFactory } from '../../infrastructure/gateways/payment-gateway.factory';
import { CreateDepositOrderCommand } from './create-deposit-order.command';
import { PaymentOrder } from '../../domain/models/payment-order.aggregate';

@Injectable()
export class CreateDepositOrderHandler {
  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly orderRepo: IPaymentOrderRepository,
    private readonly gatewayFactory: PaymentGatewayFactory,
  ) {}

  async execute(cmd: CreateDepositOrderCommand) {
    if (cmd.amount < 10000) {
      throw new BadRequestException('Số tiền nạp tối thiểu là 10.000 đ');
    }

    const orderCode = Date.now().toString();
    const order = PaymentOrder.create(
      orderCode,
      cmd.merchantId,
      cmd.amount,
      cmd.gateway,
    );

    const gatewayService = this.gatewayFactory.get(cmd.gateway);
    const result = await gatewayService.createPaymentUrl({
      orderCode,
      amount: cmd.amount,
      description: `Nap tien shop ${cmd.merchantId}`,
      returnUrl: cmd.returnUrl,
    });

    order.setPaymentUrl(result.paymentUrl);
    await this.orderRepo.save(order);

    return {
      orderCode: order.getOrderCode(),
      paymentUrl: order.getPaymentUrl(),
      amount: order.getAmount(),
      gateway: order.getGateway(),
    };
  }
}
