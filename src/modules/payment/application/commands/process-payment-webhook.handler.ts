// src/modules/payment/application/commands/process-payment-webhook.handler.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PAYMENT_ORDER_REPOSITORY } from '../../domain/repositories/payment-order.repository.interface';
import type { IPaymentOrderRepository } from '../../domain/repositories/payment-order.repository.interface';
import { DepositWalletHandler } from '../../../wallet/application/commands/deposit-wallet.handler';
import { DepositWalletCommand } from '../../../wallet/application/commands/deposit-wallet.command';
import { PaymentStatusEnum } from '../../domain/value-objects/payment-status.vo';

export interface WebhookProcessResult {
  rspCode: '00' | '01' | '02' | '04' | '99';
  message: string;
}

@Injectable()
export class ProcessPaymentWebhookHandler {
  private readonly logger = new Logger(ProcessPaymentWebhookHandler.name);

  constructor(
    @Inject(PAYMENT_ORDER_REPOSITORY)
    private readonly orderRepo: IPaymentOrderRepository,
    private readonly depositWalletHandler: DepositWalletHandler,
  ) {}

  async execute(
    orderCode: string,
    vnpAmount: number,
  ): Promise<WebhookProcessResult> {
    // 1. Kiểm tra đơn hàng tồn tại
    const order = await this.orderRepo.findByOrderCode(orderCode);
    if (!order) {
      this.logger.warn(`Order ${orderCode} not found`);
      return { rspCode: '01', message: 'Order Not Found' };
    }

    // 2. Kiểm tra số tiền có khớp với đơn hàng gốc không
    if (Number(order.getAmount()) !== Number(vnpAmount)) {
      this.logger.warn(
        `Invalid amount for order ${orderCode}: expected ${order.getAmount()}, received ${vnpAmount}`,
      );
      return { rspCode: '04', message: 'Invalid amount' };
    }

    // 3. Kiểm tra đơn hàng đã được confirm trước đó chưa
    if (order.getStatus() === PaymentStatusEnum.PAID) {
      this.logger.warn(`Order ${orderCode} already confirmed`);
      return { rspCode: '02', message: 'Order already confirmed' };
    }

    // 4. Cập nhật Order sang PAID
    order.markAsPaid();
    await this.orderRepo.save(order);

    // 5. Cộng tiền vào ví
    await this.depositWalletHandler.execute(
      new DepositWalletCommand(
        order.getMerchantId(),
        order.getAmount(),
        `DEP_${order.getGateway()}_${order.getOrderCode()}`,
        `Nạp tiền qua ${order.getGateway()} (Mã GD: ${order.getOrderCode()})`,
      ),
    );

    this.logger.log(
      `Nạp tiền thành công cho đơn ${orderCode} - Merchant: ${order.getMerchantId()}`,
    );
    return { rspCode: '00', message: 'Confirm Success' };
  }
}
