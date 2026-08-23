import { NotFoundException } from '@nestjs/common';
import { GetZbsTemplateHandler } from './get-zbs-template.handler';
import { GetZbsTemplateQuery } from './get-zbs-template.query';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';

describe('GetZbsTemplateHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const templateRepo = { findByUuidAndConnection: jest.fn() } as any;
  const handler = new GetZbsTemplateHandler(connectionRepo, templateRepo);

  beforeEach(() => jest.clearAllMocks());

  it('trả về template theo uuid trong connection của merchant', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    const template = ZbsTemplate.createDraft({
      connectionId: connection.getUuid(),
      templateName: 'Xác nhận đơn hàng',
      templateType: '1',
      tag: '1',
      layout: {},
      params: [],
    });
    templateRepo.findByUuidAndConnection.mockResolvedValueOnce(template);

    const result = await handler.execute(
      new GetZbsTemplateQuery('merchant-1', template.getUuid()),
    );

    expect(result).toBe(template);
    expect(templateRepo.findByUuidAndConnection).toHaveBeenCalledWith(
      template.getUuid(),
      connection.getUuid(),
    );
  });

  it('throw NotFoundException khi merchant chưa liên kết Zalo OA', async () => {
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new GetZbsTemplateQuery('merchant-1', 'uuid-x')),
    ).rejects.toThrow(NotFoundException);
  });

  it('throw NotFoundException khi không tìm thấy template', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    templateRepo.findByUuidAndConnection.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new GetZbsTemplateQuery('merchant-1', 'uuid-x')),
    ).rejects.toThrow(NotFoundException);
  });
});
