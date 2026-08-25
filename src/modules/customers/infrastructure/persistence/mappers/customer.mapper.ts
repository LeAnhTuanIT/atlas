import { Customer } from '../../../domain/models/customer.model';
import { CustomerOrmEntity } from '../entities/customer.orm-entity';
import { CustomerId } from '../../../domain/value-objects/customer-id.vo';
import { PhoneNumber } from '../../../domain/value-objects/phone.vo';
import { Email } from '../../../domain/value-objects/email.vo';

export class CustomerMapper {
  static toDomain(entity: CustomerOrmEntity): Customer {
    return Customer.reconstitute({
      id: new CustomerId(entity.uuid),
      merchantId: entity.merchantId,
      fullName: entity.fullName,
      phone: entity.phone ? new PhoneNumber(entity.phone) : undefined,
      email: entity.email ? new Email(entity.email) : undefined,
      passwordHash: entity.passwordHash,
      status: entity.status,
      loyaltyPoints: entity.loyaltyPoints ?? 0,
      zaloUid: entity.zaloUid ?? undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  static toPersistence(domain: Customer): CustomerOrmEntity {
    const entity = new CustomerOrmEntity();
    entity.uuid = domain.id.getValue();
    entity.merchantId = domain.merchantId;
    entity.fullName = domain.fullName;
    entity.phone = domain.phone ? domain.phone.getValue() : undefined;
    entity.email = domain.email ? domain.email.getValue() : undefined;
    entity.passwordHash = domain.passwordHash;
    entity.status = domain.status;
    entity.loyaltyPoints = domain.loyaltyPoints;
    entity.zaloUid = domain.zaloUid;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;
    return entity;
  }
}
