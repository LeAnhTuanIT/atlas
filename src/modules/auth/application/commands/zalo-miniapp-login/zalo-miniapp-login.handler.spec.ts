import {
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ZaloMiniAppLoginHandler } from './zalo-miniapp-login.handler';
import { ZaloMiniAppLoginCommand } from './zalo-miniapp-login.command';
import { Customer, CustomerStatus } from '@/modules/customers/domain/models/customer.model';
import { CustomerId } from '@/modules/customers/domain/value-objects/customer-id.vo';
import { PhoneNumber } from '@/modules/customers/domain/value-objects/phone.vo';
import { MerchantStatus } from '@/modules/merchant/domain/models/merchant.aggregate';

describe('ZaloMiniAppLoginHandler', () => {
  const resolveConnection = { resolveByMiniAppId: jest.fn() } as any;
  const gateway = { getProfile: jest.fn(), getPhoneNumber: jest.fn() } as any;
  const customerRepo = {
    findByZaloUid: jest.fn(),
    findByPhone: jest.fn(),
    save: jest.fn(),
  } as any;
  const merchantRepo = { findOne: jest.fn() } as any;
  const tokenGenerator = { generateTokens: jest.fn() } as any;

  const handler = new ZaloMiniAppLoginHandler(
    resolveConnection,
    gateway,
    customerRepo,
    merchantRepo,
    tokenGenerator,
  );

  const command = new ZaloMiniAppLoginCommand(
    'mini-app-123',
    'zalo-uid-1',
    'acc-token',
    'phone-token',
  );

  const baseConnection = {
    merchantId: 'merchant-1',
    zaloAppId: 'app-1',
    zaloAppSecret: 'secret-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveConnection.resolveByMiniAppId.mockResolvedValue(baseConnection);
    gateway.getProfile.mockResolvedValue({ uid: 'zalo-uid-1', name: 'Nguyễn Văn A' });
    gateway.getPhoneNumber.mockResolvedValue('84912345678');
    merchantRepo.findOne.mockResolvedValue({ uuid: 'merchant-1', status: MerchantStatus.ACTIVE });
    tokenGenerator.generateTokens.mockResolvedValue({
      accessToken: 'jwt-access',
      refreshToken: 'jwt-refresh',
      expiresIn: 900,
    });
  });

  it('ném UnauthorizedException khi uid gửi lên khác realUid Zalo trả về', async () => {
    gateway.getProfile.mockResolvedValueOnce({ uid: 'someone-else', name: 'X' });

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    expect(customerRepo.save).not.toHaveBeenCalled();
  });

  it('ném ForbiddenException khi merchant không ACTIVE', async () => {
    merchantRepo.findOne.mockResolvedValueOnce({ uuid: 'merchant-1', status: MerchantStatus.SUSPENDED });

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });

  it('đăng nhập thẳng khi customer đã có zaloUid khớp', async () => {
    const existing = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.ACTIVE,
      loyaltyPoints: 0,
      zaloUid: 'zalo-uid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    customerRepo.findByZaloUid.mockResolvedValueOnce(existing);

    const result = await handler.execute(command);

    expect(customerRepo.save).not.toHaveBeenCalled();
    expect(result.scope).toBe('CUSTOMER');
    expect(result.user.id).toBe(existing.id.getValue());
  });

  it('auto-link khi tìm thấy customer theo SĐT chưa có zaloUid', async () => {
    const existing = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.ACTIVE,
      loyaltyPoints: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    customerRepo.findByZaloUid.mockResolvedValueOnce(null);
    customerRepo.findByPhone.mockResolvedValueOnce(existing);

    const result = await handler.execute(command);

    expect(customerRepo.save).toHaveBeenCalledWith(existing);
    expect(existing.zaloUid).toBe('zalo-uid-1');
    expect(result.user.id).toBe(existing.id.getValue());
  });

  it('ném ConflictException khi SĐT trùng nhưng zaloUid đã gắn với người khác', async () => {
    const existing = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.ACTIVE,
      loyaltyPoints: 0,
      zaloUid: 'some-other-uid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    customerRepo.findByZaloUid.mockResolvedValueOnce(null);
    customerRepo.findByPhone.mockResolvedValueOnce(existing);

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(customerRepo.save).not.toHaveBeenCalled();
  });

  it('tạo customer mới khi chưa từng tồn tại', async () => {
    customerRepo.findByZaloUid.mockResolvedValueOnce(null);
    customerRepo.findByPhone.mockResolvedValueOnce(null);

    const result = await handler.execute(command);

    expect(customerRepo.save).toHaveBeenCalledTimes(1);
    const savedCustomer = customerRepo.save.mock.calls[0][0];
    expect(savedCustomer.zaloUid).toBe('zalo-uid-1');
    expect(savedCustomer.phone.getValue()).toBe('+84912345678');
    expect(result.scope).toBe('CUSTOMER');
  });

  it('ném ForbiddenException khi customer đã BLOCKED', async () => {
    const blocked = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.BLOCKED,
      loyaltyPoints: 0,
      zaloUid: 'zalo-uid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    customerRepo.findByZaloUid.mockResolvedValueOnce(blocked);

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });
});
