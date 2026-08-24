import { BaseEntity } from '@/shared/domain/base.entity';
import { TicketOrderLine, TicketOrderLineProps } from './ticket-order-line.entity';
import { TicketOrderChannelEnum, TicketOrderStatusEnum } from '../value-objects/ticket-enums.vo';

export interface CreateTicketOrderParams {
  merchantId: string;
  channel: TicketOrderChannelEnum;
  buyerId?: string;
  lines: Omit<TicketOrderLineProps, 'id'>[];
}

export class TicketOrder extends BaseEntity<string> {
  constructor(
    id: string,
    private readonly merchantId: string,
    private readonly channel: TicketOrderChannelEnum,
    private readonly buyerId: string | undefined,
    private lines: TicketOrderLine[],
    private status: TicketOrderStatusEnum,
    private paymentOrderCode: string | undefined,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(params: CreateTicketOrderParams): TicketOrder {
    if (!params.lines.length) {
      throw new Error('Đơn vé phải có ít nhất 1 dòng vé');
    }
    if (params.channel === TicketOrderChannelEnum.ONLINE && !params.buyerId) {
      throw new Error('Đơn vé online phải có buyerId');
    }
    return new TicketOrder(
      crypto.randomUUID(),
      params.merchantId,
      params.channel,
      params.buyerId,
      params.lines.map((l) => new TicketOrderLine(l)),
      TicketOrderStatusEnum.PENDING,
      undefined,
    );
  }

  attachPaymentOrderCode(code: string): void {
    this.paymentOrderCode = code;
    this._updatedAt = new Date();
  }

  markAsPaid(): void {
    if (this.status === TicketOrderStatusEnum.PAID) {
      return;
    }
    if (this.status !== TicketOrderStatusEnum.PENDING) {
      throw new Error(`Không thể đánh dấu PAID cho đơn ở trạng thái ${this.status}`);
    }
    this.status = TicketOrderStatusEnum.PAID;
    this._updatedAt = new Date();
  }

  markAsCancelled(): void {
    if (this.status === TicketOrderStatusEnum.CANCELLED) {
      return;
    }
    if (this.status === TicketOrderStatusEnum.PAID) {
      throw new Error(
        'Không thể huỷ đơn đã thanh toán qua markAsCancelled, dùng luồng hoàn tiền riêng',
      );
    }
    this.status = TicketOrderStatusEnum.CANCELLED;
    this._updatedAt = new Date();
  }

  markAsExpired(): void {
    if (this.status !== TicketOrderStatusEnum.PENDING) {
      return;
    }
    this.status = TicketOrderStatusEnum.EXPIRED;
    this._updatedAt = new Date();
  }

  cancelPaidOrder(): void {
    if (this.status !== TicketOrderStatusEnum.PAID) {
      throw new Error('Chỉ có thể huỷ đơn đã PAID bằng phương thức này');
    }
    this.status = TicketOrderStatusEnum.CANCELLED;
    this._updatedAt = new Date();
  }

  isPending(): boolean {
    return this.status === TicketOrderStatusEnum.PENDING;
  }

  getMerchantId(): string {
    return this.merchantId;
  }

  getChannel(): TicketOrderChannelEnum {
    return this.channel;
  }

  getBuyerId(): string | undefined {
    return this.buyerId;
  }

  getLines(): TicketOrderLine[] {
    return this.lines;
  }

  getStatus(): TicketOrderStatusEnum {
    return this.status;
  }

  getPaymentOrderCode(): string | undefined {
    return this.paymentOrderCode;
  }

  getTotalAmount(): number {
    return this.lines.reduce((sum, l) => sum + l.getTotalAmount(), 0);
  }
}
