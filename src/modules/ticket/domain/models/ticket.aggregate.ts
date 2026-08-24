import { BaseEntity } from '@/shared/domain/base.entity';
import { TicketStatusEnum } from '../value-objects/ticket-enums.vo';

export interface IssueTicketParams {
  ticketOrderId: string;
  ticketProductId: string;
  ticketSessionId: string;
  zoneId: string;
  // null = unlimited-use; số nguyên dương = số lượt còn lại (dùng ở Giai đoạn 2).
  remainingUses: number | null;
}

export class Ticket extends BaseEntity<string> {
  constructor(
    id: string,
    private readonly code: string,
    private readonly ticketOrderId: string,
    private readonly ticketProductId: string,
    private readonly ticketSessionId: string,
    private readonly zoneId: string,
    private status: TicketStatusEnum,
    private remainingUses: number | null,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static issue(params: IssueTicketParams): Ticket {
    return new Ticket(
      crypto.randomUUID(),
      Ticket.generateCode(),
      params.ticketOrderId,
      params.ticketProductId,
      params.ticketSessionId,
      params.zoneId,
      TicketStatusEnum.ISSUED,
      params.remainingUses,
    );
  }

  private static generateCode(): string {
    return `TKT-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }

  cancel(): void {
    if (this.status === TicketStatusEnum.CANCELLED) {
      return;
    }
    this.status = TicketStatusEnum.CANCELLED;
    this._updatedAt = new Date();
  }

  getCode(): string {
    return this.code;
  }

  getTicketOrderId(): string {
    return this.ticketOrderId;
  }

  getTicketProductId(): string {
    return this.ticketProductId;
  }

  getTicketSessionId(): string {
    return this.ticketSessionId;
  }

  getZoneId(): string {
    return this.zoneId;
  }

  getStatus(): TicketStatusEnum {
    return this.status;
  }

  getRemainingUses(): number | null {
    return this.remainingUses;
  }
}
