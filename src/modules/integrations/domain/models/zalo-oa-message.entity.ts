import { BaseEntity } from '@/shared/domain/base.entity';

export enum ZaloOaMessageDirectionEnum {
  IN = 'IN',
  OUT = 'OUT',
}

export interface CreateZaloOaMessageParams {
  connectionId: string;
  direction: ZaloOaMessageDirectionEnum;
  zaloUserId: string;
  content: string;
  messageType: string;
  externalMessageId?: string;
  sentAt: Date;
}

export class ZaloOaMessage extends BaseEntity<string> {
  constructor(
    uuid: string,
    private readonly connectionId: string,
    private readonly direction: ZaloOaMessageDirectionEnum,
    private readonly zaloUserId: string,
    private readonly content: string,
    private readonly messageType: string,
    private readonly externalMessageId: string | undefined,
    private readonly sentAt: Date,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(uuid, createdAt, updatedAt);
  }

  static create(params: CreateZaloOaMessageParams): ZaloOaMessage {
    return new ZaloOaMessage(
      crypto.randomUUID(),
      params.connectionId,
      params.direction,
      params.zaloUserId,
      params.content,
      params.messageType,
      params.externalMessageId,
      params.sentAt,
    );
  }

  getUuid(): string {
    return this.id;
  }
  getConnectionId(): string {
    return this.connectionId;
  }
  getDirection(): ZaloOaMessageDirectionEnum {
    return this.direction;
  }
  getZaloUserId(): string {
    return this.zaloUserId;
  }
  getContent(): string {
    return this.content;
  }
  getMessageType(): string {
    return this.messageType;
  }
  getExternalMessageId(): string | undefined {
    return this.externalMessageId;
  }
  getSentAt(): Date {
    return this.sentAt;
  }
}
