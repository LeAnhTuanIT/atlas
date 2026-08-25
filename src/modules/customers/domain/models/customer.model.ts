import { AggregateRoot } from '@nestjs/cqrs';
import { CustomerId } from '../value-objects/customer-id.vo';
import { PhoneNumber } from '../value-objects/phone.vo';
import { Email } from '../value-objects/email.vo';
import { CustomerCreatedEvent } from '../events/customer-created.event';

export enum CustomerStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

export interface CustomerProps {
  id: CustomerId;
  merchantId: string;
  phone?: PhoneNumber;
  email?: Email;
  fullName: string;
  passwordHash?: string;
  status: CustomerStatus;
  loyaltyPoints: number;
  zaloUid?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Customer extends AggregateRoot {
  private constructor(private readonly props: CustomerProps) {
    super();
  }

  static create(payload: {
    id?: CustomerId;
    merchantId: string;
    phone?: PhoneNumber;
    email?: Email;
    fullName: string;
    passwordHash?: string;
    loyaltyPoints?: number;
    zaloUid?: string;
  }): Customer {
    if (!payload.phone && !payload.email) {
      throw new Error('Khách hàng phải có ít nhất số điện thoại hoặc email');
    }

    const id = payload.id || new CustomerId();
    const customer = new Customer({
      id,
      merchantId: payload.merchantId,
      phone: payload.phone,
      email: payload.email,
      fullName: payload.fullName,
      passwordHash: payload.passwordHash,
      status: CustomerStatus.ACTIVE,
      loyaltyPoints: payload.loyaltyPoints ?? 0,
      zaloUid: payload.zaloUid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    customer.apply(
      new CustomerCreatedEvent(
        id.getValue(),
        payload.merchantId,
        payload.fullName,
        payload.phone?.getValue(),
        payload.email?.getValue(),
      ),
    );

    return customer;
  }

  static reconstitute(props: CustomerProps): Customer {
    return new Customer(props);
  }

  updateProfile(fullName: string, phone?: PhoneNumber, email?: Email): void {
    this.props.fullName = fullName;
    this.props.phone = phone;
    if (email) this.props.email = email;
    this.props.updatedAt = new Date();
  }

  addLoyaltyPoints(points: number): void {
    if (points <= 0) throw new Error('Điểm cộng phải lớn hơn 0');
    this.props.loyaltyPoints += points;
    this.props.updatedAt = new Date();
  }

  deductLoyaltyPoints(points: number): void {
    if (points <= 0) throw new Error('Điểm trừ phải lớn hơn 0');
    if (this.props.loyaltyPoints < points) {
      throw new Error('Số điểm tích lũy không đủ');
    }
    this.props.loyaltyPoints -= points;
    this.props.updatedAt = new Date();
  }

  block(): void {
    this.props.status = CustomerStatus.BLOCKED;
    this.props.updatedAt = new Date();
  }

  activate(): void {
    this.props.status = CustomerStatus.ACTIVE;
    this.props.updatedAt = new Date();
  }

  get id(): CustomerId {
    return this.props.id;
  }
  get merchantId(): string {
    return this.props.merchantId;
  }
  get phone(): PhoneNumber | undefined {
    return this.props.phone;
  }
  get email(): Email | undefined {
    return this.props.email;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get passwordHash(): string | undefined {
    return this.props.passwordHash;
  }
  get status(): CustomerStatus {
    return this.props.status;
  }
  get loyaltyPoints(): number {
    return this.props.loyaltyPoints;
  }
  get zaloUid(): string | undefined {
    return this.props.zaloUid;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
