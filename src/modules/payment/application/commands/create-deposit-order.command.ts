// src/modules/payment/application/commands/create-deposit-order.command.ts
import { PaymentGatewayEnum } from '../../domain/value-objects/payment-status.vo';

export class CreateDepositOrderCommand {
  constructor(
    public readonly merchantId: string,
    public readonly merchantName: string,
    public readonly merchantCode: string,
    public readonly amount: number,
    public readonly gateway: PaymentGatewayEnum,
    public readonly returnUrl: string,
  ) {}
}
