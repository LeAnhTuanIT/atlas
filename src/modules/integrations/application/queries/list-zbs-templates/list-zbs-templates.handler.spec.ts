import { NotFoundException } from '@nestjs/common';
import { ListZbsTemplatesHandler } from './list-zbs-templates.handler';
import { ListZbsTemplatesQuery } from './list-zbs-templates.query';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('ListZbsTemplatesHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const templateRepo = { findByConnection: jest.fn() } as any;
  const handler = new ListZbsTemplatesHandler(connectionRepo, templateRepo);

  beforeEach(() => jest.clearAllMocks());

  it('trả danh sách template của connection merchant', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    templateRepo.findByConnection.mockResolvedValueOnce([]);

    const result = await handler.execute(
      new ListZbsTemplatesQuery('merchant-1'),
    );

    expect(templateRepo.findByConnection).toHaveBeenCalledWith(
      connection.getUuid(),
    );
    expect(result).toEqual([]);
  });

  it('throw NotFoundException khi merchant chưa liên kết Zalo OA', async () => {
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new ListZbsTemplatesQuery('merchant-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
