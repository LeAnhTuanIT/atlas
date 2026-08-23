import { NotFoundException } from '@nestjs/common';
import { DeleteZbsTemplateHandler } from './delete-zbs-template.handler';
import { DeleteZbsTemplateCommand } from './delete-zbs-template.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';

describe('DeleteZbsTemplateHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const templateRepo = {
    findByUuidAndConnection: jest.fn(),
    softDelete: jest.fn(),
  } as any;
  const handler = new DeleteZbsTemplateHandler(connectionRepo, templateRepo);

  beforeEach(() => jest.clearAllMocks());

  it('xoá mềm template thuộc connection của merchant', async () => {
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

    await handler.execute(
      new DeleteZbsTemplateCommand('merchant-1', template.getUuid()),
    );

    expect(templateRepo.softDelete).toHaveBeenCalledWith(template.getUuid());
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
      handler.execute(new DeleteZbsTemplateCommand('merchant-1', 'uuid-x')),
    ).rejects.toThrow(NotFoundException);
  });
});
