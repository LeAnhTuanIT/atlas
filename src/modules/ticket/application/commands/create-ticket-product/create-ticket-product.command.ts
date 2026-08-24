import { TicketUsageRule, TicketValidityTypeEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

export class CreateTicketProductCommand {
  constructor(
    public readonly merchantId: string,
    public readonly name: string,
    public readonly description: string | undefined,
    public readonly priceAmount: number,
    public readonly priceCurrency: string,
    public readonly validityType: TicketValidityTypeEnum,
    public readonly usageRule: TicketUsageRule,
    public readonly zones: Array<{ name: string; quota: number }>,
    public readonly sessions: Array<{ startAt: Date; endAt: Date }>,
  ) {}
}
