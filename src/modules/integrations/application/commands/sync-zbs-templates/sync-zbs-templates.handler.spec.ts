import { NotFoundException } from '@nestjs/common';
import { SyncZbsTemplatesHandler } from './sync-zbs-templates.handler';
import { SyncZbsTemplatesCommand } from './sync-zbs-templates.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';

describe('SyncZbsTemplatesHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const templateRepo = {
    findByConnectionAndTemplateId: jest.fn(),
    save: jest.fn(),
  } as any;
  const zaloOaGateway = { listTemplates: jest.fn() } as any;
  const handler = new SyncZbsTemplatesHandler(
    connectionRepo,
    templateRepo,
    zaloOaGateway,
  );

  beforeEach(() => jest.clearAllMocks());

  it('tạo mới template khi chưa tồn tại trong DB', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    zaloOaGateway.listTemplates.mockResolvedValueOnce([
      { templateId: 'tpl-1', templateName: 'Xác nhận đơn', status: 'ENABLE' },
    ]);
    templateRepo.findByConnectionAndTemplateId.mockResolvedValueOnce(null);

    const result = await handler.execute(
      new SyncZbsTemplatesCommand('merchant-1'),
    );

    expect(result).toHaveLength(1);
    expect(result[0].getTemplateId()).toBe('tpl-1');
    expect(templateRepo.save).toHaveBeenCalledTimes(1);
  });

  it('cập nhật template đã tồn tại thay vì tạo mới', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    zaloOaGateway.listTemplates.mockResolvedValueOnce([
      { templateId: 'tpl-1', templateName: 'Tên mới', status: 'ENABLE' },
    ]);
    const existing = ZbsTemplate.fromSync({
      connectionId: connection.getUuid(),
      templateId: 'tpl-1',
      templateName: 'Tên cũ',
      status: 'PENDING_REVIEW',
      syncedAt: new Date(Date.now() - 60_000),
    });
    templateRepo.findByConnectionAndTemplateId.mockResolvedValueOnce(existing);

    const result = await handler.execute(
      new SyncZbsTemplatesCommand('merchant-1'),
    );

    expect(result[0].getUuid()).toBe(existing.getUuid());
    expect(result[0].getTemplateName()).toBe('Tên mới');
    expect(result[0].getStatus()).toBe('ENABLE');
    expect(templateRepo.save).toHaveBeenCalledWith(existing);
  });

  it('throw NotFoundException khi merchant chưa liên kết Zalo OA', async () => {
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new SyncZbsTemplatesCommand('merchant-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
