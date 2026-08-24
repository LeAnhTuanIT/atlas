export interface TicketOrderLineProps {
  id?: string;
  ticketProductId: string;
  ticketSessionId: string;
  zoneId: string;
  quantity: number;
  unitPrice: number;
}

export class TicketOrderLine {
  readonly id: string;
  readonly ticketProductId: string;
  readonly ticketSessionId: string;
  readonly zoneId: string;
  readonly quantity: number;
  readonly unitPrice: number;

  constructor(props: TicketOrderLineProps) {
    if (props.quantity <= 0) {
      throw new Error('Số lượng vé phải lớn hơn 0');
    }
    this.id = props.id ?? crypto.randomUUID();
    this.ticketProductId = props.ticketProductId;
    this.ticketSessionId = props.ticketSessionId;
    this.zoneId = props.zoneId;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
  }

  getId(): string {
    return this.id;
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

  getQuantity(): number {
    return this.quantity;
  }

  getUnitPrice(): number {
    return this.unitPrice;
  }

  getTotalAmount(): number {
    return this.quantity * this.unitPrice;
  }
}
