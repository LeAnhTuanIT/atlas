import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ResolveZaloMiniAppConnectionService } from './resolve-zalo-miniapp-connection.service';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('ResolveZaloMiniAppConnectionService', () => {
  const connectionRepo = { findByExternalId: jest.fn() } as any;
  const service = new ResolveZaloMiniAppConnectionService(connectionRepo);

  beforeEach(() => jest.clearAllMocks());

  it('trả về merchantId/zaloAppId/zaloAppSecret khi connection ACTIVE tồn tại', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_MINI_APP,
      'mini-app-123',
      { accessToken: '', refreshToken: '', expiresAt: new Date('2999-01-01') },
      { zaloAppId: 'app-1', zaloAppSecret: 'secret-1' },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);

    const result = await service.resolveByMiniAppId('mini-app-123');

    expect(connectionRepo.findByExternalId).toHaveBeenCalledWith(
      IntegrationProviderEnum.ZALO_MINI_APP,
      'mini-app-123',
    );
    expect(result).toEqual({
      merchantId: 'merchant-1',
      zaloAppId: 'app-1',
      zaloAppSecret: 'secret-1',
    });
  });

  it('ném NotFoundException khi không tìm thấy connection', async () => {
    connectionRepo.findByExternalId.mockResolvedValueOnce(null);

    await expect(service.resolveByMiniAppId('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('ném ForbiddenException khi connection bị revoke', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_MINI_APP,
      'mini-app-123',
      { accessToken: '', refreshToken: '', expiresAt: new Date('2999-01-01') },
      { zaloAppId: 'app-1', zaloAppSecret: 'secret-1' },
    );
    connection.revoke();
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);

    await expect(service.resolveByMiniAppId('mini-app-123')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
