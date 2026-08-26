import { Customer } from '../../../domain/models/customer.model';
import { CustomerOrmEntity, CustomerStatus } from '../entities/customer.orm-entity';
import { CustomerMapper } from './customer.mapper';
import { PhoneNumber } from '../../../domain/value-objects/phone.vo';

describe('CustomerMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên zaloUid', () => {
    const domain = Customer.create({
      merchantId: 'merchant-1',
      fullName: 'Nguyễn Văn A',
      phone: new PhoneNumber('0901234567'),
      zaloUid: 'uid-999',
    });

    const orm = CustomerMapper.toPersistence(domain);
    expect(orm.zaloUid).toBe('uid-999');

    const roundTripped = CustomerMapper.toDomain(orm);
    expect(roundTripped.zaloUid).toBe('uid-999');
  });

  it('toDomain() trả undefined khi orm.zaloUid rỗng', () => {
    const orm = new CustomerOrmEntity();
    orm.uuid = '11111111-1111-4111-8111-111111111111';
    orm.merchantId = 'merchant-1';
    orm.fullName = 'B';
    orm.status = CustomerStatus.ACTIVE;
    orm.loyaltyPoints = 0;
    orm.createdAt = new Date();
    orm.updatedAt = new Date();

    const domain = CustomerMapper.toDomain(orm);
    expect(domain.zaloUid).toBeUndefined();
  });
});
