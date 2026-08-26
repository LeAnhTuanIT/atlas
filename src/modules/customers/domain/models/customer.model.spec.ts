import { Customer, CustomerStatus } from './customer.model';
import { CustomerId } from '../value-objects/customer-id.vo';
import { PhoneNumber } from '../value-objects/phone.vo';

describe('Customer.linkZaloAccount', () => {
  it('gán zaloUid và cập nhật updatedAt', () => {
    const customer = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.ACTIVE,
      loyaltyPoints: 0,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    customer.linkZaloAccount('zalo-uid-123');

    expect(customer.zaloUid).toBe('zalo-uid-123');
    expect(customer.updatedAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00Z').getTime(),
    );
  });
});
