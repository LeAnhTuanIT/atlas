import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { PaymentGatewayEnum } from '@/modules/payment/domain/value-objects/payment-status.vo';

export interface CreateTicketOrderLineInput {
  ticketProductId: string;
  ticketSessionId: string;
  zoneId: string;
  quantity: number;
}

export class CreateTicketOrderCommand {
  constructor(
    public readonly merchantId: string,
    public readonly channel: TicketOrderChannelEnum,
    public readonly buyerId: string | undefined,
    public readonly lines: CreateTicketOrderLineInput[],
    public readonly gateway?: PaymentGatewayEnum,
    public readonly returnUrl?: string,
  ) {}
}
