import { NotFoundException } from '@nestjs/common';
import { UpdateZbsTemplateDraftHandler } from './update-zbs-template-draft.handler';
import { UpdateZbsTemplateDraftCommand } from './update-zbs-template-draft.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';

describe('UpdateZbsTemplateDraftHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const templateRepo = {
    findByUuidAndConnection: jest.fn(),
    save: jest.fn(),
  } as any;
  const handler = new UpdateZbsTemplateDraftHandler(
    connectionRepo,
    templateRepo,
  );

  beforeEach(() => jest.clearAllMocks());

  it('cập nhật nội dung draft và lưu lại', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    const template = ZbsTemplate.createDraft({
      connectionId: connection.getUuid(),
      templateName: 'Tên cũ',
      templateType: '1',
      tag: '1',
      layout: {},
      params: [],
    });
    templateRepo.findByUuidAndConnection.mockResolvedValueOnce(template);

    const result = await handler.execute(
      new UpdateZbsTemplateDraftCommand('merchant-1', template.getUuid(), {
        templateName: 'Tên mới',
      }),
    );

    expect(result.getTemplateName()).toBe('Tên mới');
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
      handler.execute(
        new UpdateZbsTemplateDraftCommand('merchant-1', 'uuid-x', {}),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
