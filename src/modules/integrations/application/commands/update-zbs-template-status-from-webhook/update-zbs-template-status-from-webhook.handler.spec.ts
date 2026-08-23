import { UpdateZbsTemplateStatusFromWebhookHandler } from './update-zbs-template-status-from-webhook.handler';
import { UpdateZbsTemplateStatusFromWebhookCommand } from './update-zbs-template-status-from-webhook.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';

describe('UpdateZbsTemplateStatusFromWebhookHandler', () => {
  const connectionRepo = { findByExternalId: jest.fn() } as any;
  const templateRepo = {
    findByConnectionAndTemplateId: jest.fn(),
    save: jest.fn(),
  } as any;
  const handler = new UpdateZbsTemplateStatusFromWebhookHandler(
    connectionRepo,
    templateRepo,
  );

  beforeEach(() => jest.clearAllMocks());

  it('cập nhật status + reason khi tìm thấy connection và template', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);
    const template = ZbsTemplate.fromSync({
      connectionId: connection.getUuid(),
      templateId: 'zns-tpl-1',
      templateName: 'Xác nhận đơn hàng',
      status: 'PENDING_REVIEW',
      syncedAt: new Date(),
    });
    templateRepo.findByConnectionAndTemplateId.mockResolvedValueOnce(template);

    await handler.execute(
      new UpdateZbsTemplateStatusFromWebhookCommand(
        'oa-123',
        'zns-tpl-1',
        'REJECT',
        'Logo không hợp lệ',
      ),
    );

    expect(template.getStatus()).toBe('REJECT');
    expect(template.getReason()).toBe('Logo không hợp lệ');
    expect(templateRepo.save).toHaveBeenCalledWith(template);
  });

  it('bỏ qua (không throw) khi không tìm thấy connection theo oaId', async () => {
    connectionRepo.findByExternalId.mockResolvedValueOnce(null);

    await handler.execute(
      new UpdateZbsTemplateStatusFromWebhookCommand(
        'oa-khong-ton-tai',
        'zns-tpl-1',
        'REJECT',
        undefined,
      ),
    );

    expect(templateRepo.save).not.toHaveBeenCalled();
  });

  it('bỏ qua (không throw) khi không tìm thấy template theo templateId', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);
    templateRepo.findByConnectionAndTemplateId.mockResolvedValueOnce(null);

    await handler.execute(
      new UpdateZbsTemplateStatusFromWebhookCommand(
        'oa-123',
        'zns-tpl-khong-ton-tai',
        'REJECT',
        undefined,
      ),
    );

    expect(templateRepo.save).not.toHaveBeenCalled();
  });
});
