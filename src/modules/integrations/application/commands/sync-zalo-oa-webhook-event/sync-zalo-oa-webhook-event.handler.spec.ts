import { SyncZaloOaWebhookEventHandler } from './sync-zalo-oa-webhook-event.handler';
import { SyncZaloOaWebhookEventCommand } from './sync-zalo-oa-webhook-event.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('SyncZaloOaWebhookEventHandler', () => {
  const connectionRepo = { findByExternalId: jest.fn() } as any;
  const messageRepo = {
    save: jest.fn(),
    existsByExternalMessageId: jest.fn(),
  } as any;
  const handler = new SyncZaloOaWebhookEventHandler(
    connectionRepo,
    messageRepo,
  );

  beforeEach(() => jest.clearAllMocks());

  it('lưu message IN khi event là user_send_text và connection tồn tại', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);
    messageRepo.existsByExternalMessageId.mockResolvedValueOnce(false);

    await handler.execute(
      new SyncZaloOaWebhookEventCommand(
        'oa-123',
        'user_send_text',
        'zalo-user-1',
        'Xin chào shop',
        'msg-in-1',
        1755936000,
      ),
    );

    expect(messageRepo.save).toHaveBeenCalledTimes(1);
    const saved = messageRepo.save.mock.calls[0][0];
    expect(saved.getContent()).toBe('Xin chào shop');
    expect(saved.getExternalMessageId()).toBe('msg-in-1');
  });

  it('bỏ qua khi message đã tồn tại (idempotent, webhook gửi trùng)', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);
    messageRepo.existsByExternalMessageId.mockResolvedValueOnce(true);

    await handler.execute(
      new SyncZaloOaWebhookEventCommand(
        'oa-123',
        'user_send_text',
        'zalo-user-1',
        'Xin chào shop',
        'msg-in-1',
        1755936000,
      ),
    );

    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it('bỏ qua khi không tìm thấy connection theo oaId', async () => {
    connectionRepo.findByExternalId.mockResolvedValueOnce(null);

    await handler.execute(
      new SyncZaloOaWebhookEventCommand(
        'oa-khong-ton-tai',
        'user_send_text',
        'zalo-user-1',
        'Xin chào',
        'msg-in-2',
        1755936000,
      ),
    );

    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it('bỏ qua khi event_name không phải user_send_text', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);

    await handler.execute(
      new SyncZaloOaWebhookEventCommand(
        'oa-123',
        'follow',
        'zalo-user-1',
        '',
        undefined,
        1755936000,
      ),
    );

    expect(messageRepo.save).not.toHaveBeenCalled();
  });
});
