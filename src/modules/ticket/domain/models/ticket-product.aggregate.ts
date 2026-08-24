import { BaseEntity } from '@/shared/domain/base.entity';
import { TicketZone, TicketZoneProps } from './ticket-zone.entity';
import { TicketSession, TicketSessionProps } from './ticket-session.entity';
import {
  TicketProductStatusEnum,
  TicketUsageRule,
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '../value-objects/ticket-enums.vo';

export interface CreateTicketProductParams {
  merchantId: string;
  name: string;
  description?: string;
  priceAmount: number;
  priceCurrency: string;
  validityType: TicketValidityTypeEnum;
  usageRule: TicketUsageRule;
  zones: Array<{ name: string; quota: number }>;
  sessions: Array<{ startAt: Date; endAt: Date }>;
}

export class TicketProduct extends BaseEntity<string> {
  constructor(
    id: string,
    private readonly merchantId: string,
    private name: string,
    private description: string | undefined,
    private priceAmount: number,
    private priceCurrency: string,
    private readonly validityType: TicketValidityTypeEnum,
    private readonly usageRule: TicketUsageRule,
    private zones: TicketZone[],
    private sessions: TicketSession[],
    private status: TicketProductStatusEnum,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(params: CreateTicketProductParams): TicketProduct {
    if (params.priceAmount < 0) {
      throw new Error('Giá vé không được âm');
    }
    if (!params.zones.length) {
      throw new Error('Loại vé phải có ít nhất 1 zone');
    }
    if (params.zones.some((z) => z.quota <= 0)) {
      throw new Error('Quota của zone phải lớn hơn 0');
    }
    if (!params.sessions.length) {
      throw new Error('Loại vé phải có ít nhất 1 session hiệu lực');
    }
    if (
      params.usageRule.type === TicketUsageTypeEnum.LIMITED_USE &&
      (!params.usageRule.maxUses || params.usageRule.maxUses <= 0)
    ) {
      throw new Error('LIMITED_USE phải có maxUses > 0');
    }

    return new TicketProduct(
      crypto.randomUUID(),
      params.merchantId,
      params.name,
      params.description,
      params.priceAmount,
      params.priceCurrency,
      params.validityType,
      params.usageRule,
      params.zones.map((z: TicketZoneProps) => new TicketZone(z)),
      params.sessions.map((s: TicketSessionProps) => new TicketSession(s)),
      TicketProductStatusEnum.DRAFT,
    );
  }

  publish(): void {
    if (this.status !== TicketProductStatusEnum.DRAFT) {
      throw new Error(`Không thể publish loại vé đang ở trạng thái ${this.status}`);
    }
    this.status = TicketProductStatusEnum.PUBLISHED;
    this._updatedAt = new Date();
  }

  isPublished(): boolean {
    return this.status === TicketProductStatusEnum.PUBLISHED;
  }

  findZone(zoneId: string): TicketZone | undefined {
    return this.zones.find((z) => z.getId() === zoneId);
  }

  findSession(sessionId: string): TicketSession | undefined {
    return this.sessions.find((s) => s.getId() === sessionId);
  }

  getMerchantId(): string {
    return this.merchantId;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getPriceAmount(): number {
    return this.priceAmount;
  }

  getPriceCurrency(): string {
    return this.priceCurrency;
  }

  getValidityType(): TicketValidityTypeEnum {
    return this.validityType;
  }

  getUsageRule(): TicketUsageRule {
    return this.usageRule;
  }

  getZones(): TicketZone[] {
    return this.zones;
  }

  getSessions(): TicketSession[] {
    return this.sessions;
  }

  getStatus(): TicketProductStatusEnum {
    return this.status;
  }
}
