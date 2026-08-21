// src/modules/merchant/domain/models/merchant.aggregate.ts
import { MerchantCode } from '../value-objects/merchant-code.vo';

export enum MerchantStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export interface MerchantProps {
  id?: string;
  uuid: string;
  code: MerchantCode;
  name: string;
  status: MerchantStatus;
  settings?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export class MerchantAggregate {
  private props: MerchantProps;

  private constructor(props: MerchantProps) {
    this.props = props;
  }

  public static create(
    props: Omit<MerchantProps, 'uuid' | 'status'> & { uuid?: string; status?: MerchantStatus },
  ): MerchantAggregate {
    return new MerchantAggregate({
      ...props,
      uuid: props.uuid || crypto.randomUUID(),
      status: props.status || MerchantStatus.ACTIVE,
      settings: props.settings || {},
    });
  }

  public static reconstitute(props: MerchantProps): MerchantAggregate {
    return new MerchantAggregate(props);
  }

  // Domain Behaviors
  public suspend(reason: string): void {
    this.props.status = MerchantStatus.SUSPENDED;
    this.props.settings = { ...this.props.settings, suspendReason: reason };
  }

  public activate(): void {
    this.props.status = MerchantStatus.ACTIVE;
  }

  public updateInfo(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Tên merchant không được rỗng.');
    }
    this.props.name = name.trim();
  }

  // Getters
  get id(): string | undefined { return this.props.id; }
  get uuid(): string { return this.props.uuid; }
  get code(): MerchantCode { return this.props.code; }
  get name(): string { return this.props.name; }
  get status(): MerchantStatus { return this.props.status; }
  get settings(): Record<string, any> | undefined { return this.props.settings; }
}