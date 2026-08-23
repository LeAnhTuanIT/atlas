import { NotFoundException } from '@nestjs/common';
import { CreateZbsTemplateDraftHandler } from './create-zbs-template-draft.handler';
import { CreateZbsTemplateDraftCommand } from './create-zbs-template-draft.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('CreateZbsTemplateDraftHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const templateRepo = { save: jest.fn() } as any;
  const handler = new CreateZbsTemplateDraftHandler(connectionRepo, templateRepo);

  beforeEach(() => jest.clearAllMocks());

  it('tạo draft cục bộ gắn với connection của merchant', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);

    const result = await handler.execute(
      new CreateZbsTemplateDraftCommand(
        'merchant-1',
        'Xác nhận đơn hàng',
        '1',
        '1',
        { body: { components: [] } },
        [{ type: '1', name: 'name', sample_value: 'A' }],
        'ghi chú',
        'track-1',
      ),
    );

    expect(result.getConnectionId()).toBe(connection.getUuid());
    expect(result.getTemplateName()).toBe('Xác nhận đơn hàng');
    expect(result.getStatus()).toBe('DRAFT');
    expect(result.getTemplateId()).toBeUndefined();
    expect(templateRepo.save).toHaveBeenCalledWith(result);
  });

  it('throw NotFoundException khi merchant chưa liên kết Zalo OA', async () => {
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    await expect(
      handler.execute(
        new CreateZbsTemplateDraftCommand(
          'merchant-1',
          'Xác nhận đơn hàng',
          '1',
          '1',
          {},
          [],
        ),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
