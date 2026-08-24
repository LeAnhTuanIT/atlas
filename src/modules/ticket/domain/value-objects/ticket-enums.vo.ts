export enum TicketProductStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum TicketValidityTypeEnum {
  DAY_PASS = 'DAY_PASS',
  SESSION = 'SESSION',
}

export enum TicketUsageTypeEnum {
  UNLIMITED_USE = 'UNLIMITED_USE',
  LIMITED_USE = 'LIMITED_USE',
}

export interface TicketUsageRule {
  type: TicketUsageTypeEnum;
  // Bắt buộc phải có giá trị > 0 khi type = LIMITED_USE, bỏ trống khi UNLIMITED_USE.
  maxUses?: number;
}

export enum TicketOrderChannelEnum {
  ONLINE = 'ONLINE',
  COUNTER = 'COUNTER',
}

export enum TicketOrderStatusEnum {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum TicketStatusEnum {
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}
