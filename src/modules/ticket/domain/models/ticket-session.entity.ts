export interface TicketSessionProps {
  id?: string;
  startAt: Date;
  endAt: Date;
}

export class TicketSession {
  readonly id: string;
  private startAt: Date;
  private endAt: Date;

  constructor(props: TicketSessionProps) {
    if (props.endAt <= props.startAt) {
      throw new Error('Thời điểm kết thúc session phải sau thời điểm bắt đầu');
    }
    this.id = props.id ?? crypto.randomUUID();
    this.startAt = props.startAt;
    this.endAt = props.endAt;
  }

  getId(): string {
    return this.id;
  }

  getStartAt(): Date {
    return this.startAt;
  }

  getEndAt(): Date {
    return this.endAt;
  }

  isActiveAt(now: Date): boolean {
    return now <= this.endAt;
  }
}
