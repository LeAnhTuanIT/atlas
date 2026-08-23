import { LinkZaloOaHandler } from './link-zalo-oa.handler';
import { LinkZaloOaCommand } from './link-zalo-oa.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('LinkZaloOaHandler', () => {
  const gateway = {
    exchangeCode: jest.fn(),
  } as any;
  const repo = {
    findByMerchantAndProvider: jest.fn(),
    save: jest.fn(),
  } as any;
  const handler = new LinkZaloOaHandler(gateway, repo);

  beforeEach(() => jest.clearAllMocks());

  it('tạo mới connection khi merchant chưa liên kết OA nào', async () => {
    gateway.exchangeCode.mockResolvedValueOnce({
      accessToken: 'acc-1',
      refreshToken: 'ref-1',
      expiresIn: 3600,
    });
    repo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    const result = await handler.execute(
      new LinkZaloOaCommand('merchant-1', 'code-abc', 'oa-123'),
    );

    expect(gateway.exchangeCode).toHaveBeenCalledWith('code-abc');
    expect(result.getMerchantId()).toBe('merchant-1');
    expect(result.getExternalId()).toBe('oa-123');
    expect(result.getProvider()).toBe(IntegrationProviderEnum.ZALO_OA);
    expect(repo.save).toHaveBeenCalledWith(result);
  });

  it('cập nhật token của connection cũ khi merchant liên kết lại', async () => {
    const existing = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-cu',
      {
        accessToken: 'acc-cu',
        refreshToken: 'ref-cu',
        expiresAt: new Date(Date.now() - 1000),
      },
    );
    repo.findByMerchantAndProvider.mockResolvedValueOnce(existing);
    gateway.exchangeCode.mockResolvedValueOnce({
      accessToken: 'acc-moi',
      refreshToken: 'ref-moi',
      expiresIn: 3600,
    });

    const result = await handler.execute(
      new LinkZaloOaCommand('merchant-1', 'code-moi', 'oa-moi'),
    );

    expect(result.getUuid()).toBe(existing.getUuid()); // vẫn là cùng 1 bản ghi
    expect(result.getAccessToken()).toBe('acc-moi');
    expect(repo.save).toHaveBeenCalledWith(existing);
  });
});
