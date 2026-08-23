import { NotFoundException } from '@nestjs/common';
import { SendZaloOaMessageHandler } from './send-zalo-oa-message.handler';
import { SendZaloOaMessageCommand } from './send-zalo-oa-message.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('SendZaloOaMessageHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const messageRepo = { save: jest.fn() } as any;
  const gatewayFactory = {
    getMessagingGateway: jest.fn(),
  } as any;
  const handler = new SendZaloOaMessageHandler(
    connectionRepo,
    messageRepo,
    gatewayFactory,
  );

  beforeEach(() => jest.clearAllMocks());

  it('gửi tin thành công và lưu message OUT', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      {
        accessToken: 'a',
        refreshToken: 'b',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    const sendMessage = jest
      .fn()
      .mockResolvedValueOnce({ externalMessageId: 'msg-out-1' });
    gatewayFactory.getMessagingGateway.mockReturnValueOnce({ sendMessage });

    const result = await handler.execute(
      new SendZaloOaMessageCommand('merchant-1', 'zalo-user-1', 'Xin chào'),
    );

    expect(result).toEqual({ externalMessageId: 'msg-out-1' });
    expect(sendMessage).toHaveBeenCalledWith({
      connectionId: connection.getUuid(),
      to: 'zalo-user-1',
      content: 'Xin chào',
      type: undefined,
    });
    expect(messageRepo.save).toHaveBeenCalledTimes(1);
    const savedMessage = messageRepo.save.mock.calls[0][0];
    expect(savedMessage.getExternalMessageId()).toBe('msg-out-1');
    expect(savedMessage.getZaloUserId()).toBe('zalo-user-1');
  });

  it('throw NotFoundException khi merchant chưa liên kết OA', async () => {
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    await expect(
      handler.execute(
        new SendZaloOaMessageCommand('merchant-1', 'zalo-user-1', 'Xin chào'),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
