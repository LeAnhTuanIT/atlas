import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '@/app.module';
import { ZaloMiniAppGateway } from '@/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway';
import { IntegrationConnectionOrmEntity } from '@/modules/integrations/infrastructure/persistence/entities/integration-connection.orm-entity';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationStatusEnum } from '@/modules/integrations/domain/value-objects/integration-status.vo';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { CustomerOrmEntity } from '@/modules/customers/infrastructure/persistence/entities/customer.orm-entity';

describe('POST /auth/zalo-miniapp/login (e2e)', () => {
  let app: INestApplication<App>;
  let merchantId: string;
  const zaloMiniAppId = `e2e-mini-app-${Date.now()}`;

  const mockGateway = {
    getProfile: jest.fn(),
    getPhoneNumber: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ZaloMiniAppGateway)
      .useValue(mockGateway)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const merchantRepo = moduleRef.get(getRepositoryToken(MerchantOrmEntity));
    const merchant = await merchantRepo.save(
      merchantRepo.create({ code: `E2E-MINIAPP-${Date.now()}`, name: 'E2E Merchant' }),
    );
    merchantId = merchant.uuid;

    const connectionRepo = moduleRef.get(
      getRepositoryToken(IntegrationConnectionOrmEntity),
    );
    await connectionRepo.save(
      connectionRepo.create({
        merchantId,
        provider: IntegrationProviderEnum.ZALO_MINI_APP,
        externalId: zaloMiniAppId,
        status: IntegrationStatusEnum.ACTIVE,
        metadata: { zaloAppId: 'app-e2e', zaloAppSecret: 'secret-e2e' },
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('tạo customer mới và trả accessToken/refreshToken trong body khi lần đầu đăng nhập', async () => {
    mockGateway.getProfile.mockResolvedValueOnce({ uid: 'e2e-uid-1', name: 'Khách E2E' });
    mockGateway.getPhoneNumber.mockResolvedValueOnce('84911111111');

    const response = await request(app.getHttpServer())
      .post('/auth/zalo-miniapp/login')
      .send({
        zaloMiniAppId,
        uid: 'e2e-uid-1',
        accessToken: 'acc-1',
        phoneToken: 'phone-1',
      })
      .expect(200);

    expect(response.body.data.scope).toBe('CUSTOMER');
    expect(response.body.data.user.phone).toBe('+84911111111');
    expect(typeof response.body.data.accessToken).toBe('string');
    expect(typeof response.body.data.refreshToken).toBe('string');
  });

  it('đăng nhập lại không cần phoneToken khi customer đã có zaloUid', async () => {
    mockGateway.getPhoneNumber.mockClear();
    mockGateway.getProfile.mockResolvedValueOnce({ uid: 'e2e-uid-1', name: 'Khách E2E' });

    const response = await request(app.getHttpServer())
      .post('/auth/zalo-miniapp/login')
      .send({
        zaloMiniAppId,
        uid: 'e2e-uid-1',
        accessToken: 'acc-no-phone',
      })
      .expect(200);

    expect(mockGateway.getPhoneNumber).not.toHaveBeenCalled();
    expect(response.body.data.user.phone).toBe('+84911111111');
  });

  it('đăng nhập lại trả về cùng customer (không tạo bản ghi mới)', async () => {
    mockGateway.getProfile.mockResolvedValueOnce({ uid: 'e2e-uid-1', name: 'Khách E2E' });
    mockGateway.getPhoneNumber.mockResolvedValueOnce('84911111111');

    const response = await request(app.getHttpServer())
      .post('/auth/zalo-miniapp/login')
      .send({
        zaloMiniAppId,
        uid: 'e2e-uid-1',
        accessToken: 'acc-2',
        phoneToken: 'phone-2',
      })
      .expect(200);

    const customerRepo = app.get(getRepositoryToken(CustomerOrmEntity));
    const count = await customerRepo.count({ where: { merchantId, zaloUid: 'e2e-uid-1' } });
    expect(count).toBe(1);
    expect(response.body.data.user.phone).toBe('+84911111111');
  });

  it('trả 401 khi uid không khớp với Zalo thật', async () => {
    mockGateway.getProfile.mockResolvedValueOnce({ uid: 'real-uid', name: 'X' });

    await request(app.getHttpServer())
      .post('/auth/zalo-miniapp/login')
      .send({
        zaloMiniAppId,
        uid: 'claimed-uid',
        accessToken: 'acc-3',
        phoneToken: 'phone-3',
      })
      .expect(401);
  });

  it('trả 404 khi zaloMiniAppId không tồn tại', async () => {
    await request(app.getHttpServer())
      .post('/auth/zalo-miniapp/login')
      .send({
        zaloMiniAppId: 'unknown-mini-app',
        uid: 'x',
        accessToken: 'acc-4',
        phoneToken: 'phone-4',
      })
      .expect(404);
  });
});
