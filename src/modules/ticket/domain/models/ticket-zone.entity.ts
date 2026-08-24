export interface TicketZoneProps {
  id?: string;
  name: string;
  quota: number;
}

export class TicketZone {
  readonly id: string;
  private name: string;
  private quota: number;

  constructor(props: TicketZoneProps) {
    this.id = props.id ?? crypto.randomUUID();
    this.name = props.name;
    this.quota = props.quota;
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getQuota(): number {
    return this.quota;
  }
}
