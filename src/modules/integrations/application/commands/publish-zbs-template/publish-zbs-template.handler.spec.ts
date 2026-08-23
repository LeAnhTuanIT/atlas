import { NotFoundException } from '@nestjs/common';
import { PublishZbsTemplateHandler } from './publish-zbs-template.handler';
import { PublishZbsTemplateCommand } from './publish-zbs-template.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';

describe('PublishZbsTemplateHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const templateRepo = {
    findByUuidAndConnection: jest.fn(),
    save: jest.fn(),
  } as any;
  const zaloOaGateway = { publishTemplate: jest.fn() } as any;
  const handler = new PublishZbsTemplateHandler(
    connectionRepo,
    templateRepo,
    zaloOaGateway,
  );

  beforeEach(() => jest.clearAllMocks());

  it('publish draft (chưa có templateId) và cập nhật templateId/status trả về', async () => {
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
    zaloOaGateway.publishTemplate.mockResolvedValueOnce({
      templateId: 'zns-tpl-99',
      status: 'PENDING_REVIEW',
    });

    const result = await handler.execute(
      new PublishZbsTemplateCommand('merchant-1', template.getUuid()),
    );

    expect(zaloOaGateway.publishTemplate).toHaveBeenCalledWith(
      connection.getUuid(),
      template,
    );
    expect(result.getTemplateId()).toBe('zns-tpl-99');
    expect(result.getStatus()).toBe('PENDING_REVIEW');
    expect(templateRepo.save).toHaveBeenCalledWith(template);
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
      handler.execute(new PublishZbsTemplateCommand('merchant-1', 'uuid-x')),
    ).rejects.toThrow(NotFoundException);
  });
});
