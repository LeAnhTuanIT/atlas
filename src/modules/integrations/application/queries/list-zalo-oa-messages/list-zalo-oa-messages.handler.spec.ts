import { NotFoundException } from '@nestjs/common';
import { ListZaloOaMessagesHandler } from './list-zalo-oa-messages.handler';
import { ListZaloOaMessagesQuery } from './list-zalo-oa-messages.query';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('ListZaloOaMessagesHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const messageRepo = { findByConnection: jest.fn() } as any;
  const handler = new ListZaloOaMessagesHandler(connectionRepo, messageRepo);

  beforeEach(() => jest.clearAllMocks());

  it('trả danh sách message phân trang của connection merchant', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    messageRepo.findByConnection.mockResolvedValueOnce({
      items: [],
      hasNextPage: false,
      nextCursor: null,
    });

    const result = await handler.execute(
      new ListZaloOaMessagesQuery('merchant-1', undefined, 20),
    );

    expect(messageRepo.findByConnection).toHaveBeenCalledWith(
      connection.getUuid(),
      { cursor: undefined, limit: 20 },
    );
    expect(result).toEqual({ items: [], hasNextPage: false, nextCursor: null });
  });

  it('throw NotFoundException khi merchant chưa liên kết OA', async () => {
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new ListZaloOaMessagesQuery('merchant-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
