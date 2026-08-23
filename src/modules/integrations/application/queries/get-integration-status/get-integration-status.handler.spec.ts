import { GetIntegrationStatusHandler } from './get-integration-status.handler';
import { GetIntegrationStatusQuery } from './get-integration-status.query';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('GetIntegrationStatusHandler', () => {
  const repo = { findByMerchantAndProvider: jest.fn() } as any;
  const handler = new GetIntegrationStatusHandler(repo);

  it('trả connected=false khi chưa liên kết', async () => {
    repo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    const result = await handler.execute(
      new GetIntegrationStatusQuery('merchant-1', IntegrationProviderEnum.ZALO_OA),
    );

    expect(result).toEqual({ connected: false });
  });

  it('trả thông tin liên kết khi đã liên kết', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      {
        accessToken: 'a',
        refreshToken: 'b',
        expiresAt: new Date(Date.now() + 3600_000),
      },
      { name: 'Shop ABC' },
    );
    repo.findByMerchantAndProvider.mockResolvedValueOnce(connection);

    const result = await handler.execute(
      new GetIntegrationStatusQuery('merchant-1', IntegrationProviderEnum.ZALO_OA),
    );

    expect(result.connected).toBe(true);
    expect(result.externalId).toBe('oa-123');
    expect(result.metadata).toEqual({ name: 'Shop ABC' });
  });
});
