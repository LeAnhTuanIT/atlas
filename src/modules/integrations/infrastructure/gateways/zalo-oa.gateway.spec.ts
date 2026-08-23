import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import { ZaloOaGateway } from './zalo-oa.gateway';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZaloOaGateway', () => {
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string> = {
        ZALO_OA_APP_ID: 'app-id',
        ZALO_OA_SECRET_KEY: 'secret-key',
        ZALO_OA_REDIRECT_URI: 'https://api.example.com/callback',
      };
      return map[key];
    }),
  } as unknown as ConfigService;

  const connectionRepo = {
    findById: jest.fn(),
    save: jest.fn(),
  } as any;

  const gateway = new ZaloOaGateway(configService, connectionRepo);

  beforeEach(() => jest.clearAllMocks());

  it('getProvider() trả ZALO_OA', () => {
    expect(gateway.getProvider()).toBe(IntegrationProviderEnum.ZALO_OA);
  });

  it('getAuthUrl() sinh đúng URL với app_id/redirect_uri/state', () => {
    const url = gateway.getAuthUrl('state-abc');
    expect(url).toBe(
      'https://oauth.zaloapp.com/v4/oa/permission?app_id=app-id&redirect_uri=https%3A%2F%2Fapi.example.com%2Fcallback&state=state-abc',
    );
  });

  it('exchangeCode() gọi Zalo API và map kết quả', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: 'acc-1',
        refresh_token: 'ref-1',
        expires_in: '3600',
      },
    });

    const result = await gateway.exchangeCode('code-123');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://oauth.zaloapp.com/v4/oa/access_token',
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: expect.objectContaining({ secret_key: 'secret-key' }),
      }),
    );
    expect(result).toEqual({
      accessToken: 'acc-1',
      refreshToken: 'ref-1',
      expiresIn: 3600,
    });
  });

  it('exchangeCode() throw BadGatewayException khi Zalo trả lỗi', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { error: 1, error_description: 'Code không hợp lệ' },
    });

    await expect(gateway.exchangeCode('code-sai')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('sendMessage() dùng access token hiện có khi chưa sắp hết hạn', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-1',
      {
        accessToken: 'acc-valid',
        refreshToken: 'ref-1',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    );
    connectionRepo.findById.mockResolvedValueOnce(connection);
    mockedAxios.post.mockResolvedValueOnce({
      data: { data: { message_id: 'msg-out-1' } },
    });

    const result = await gateway.sendMessage({
      connectionId: connection.getUuid(),
      to: 'zalo-user-1',
      content: 'Xin chào',
    });

    expect(result).toEqual({ externalMessageId: 'msg-out-1' });
    expect(connectionRepo.save).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://openapi.zalo.me/v3.0/oa/message/cs',
      { recipient: { user_id: 'zalo-user-1' }, message: { text: 'Xin chào' } },
      expect.objectContaining({
        headers: expect.objectContaining({ access_token: 'acc-valid' }),
      }),
    );
  });

  it('sendMessage() refresh token trước khi gửi khi token sắp hết hạn', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-1',
      {
        accessToken: 'acc-old',
        refreshToken: 'ref-old',
        expiresAt: new Date(Date.now() + 60_000), // còn 1 phút
      },
    );
    connectionRepo.findById.mockResolvedValueOnce(connection);
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          access_token: 'acc-new',
          refresh_token: 'ref-new',
          expires_in: '3600',
        },
      })
      .mockResolvedValueOnce({ data: { data: { message_id: 'msg-out-2' } } });

    const result = await gateway.sendMessage({
      connectionId: connection.getUuid(),
      to: 'zalo-user-1',
      content: 'Xin chào',
    });

    expect(result).toEqual({ externalMessageId: 'msg-out-2' });
    expect(connectionRepo.save).toHaveBeenCalledTimes(1);
    expect(connection.getAccessToken()).toBe('acc-new');
    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      'https://openapi.zalo.me/v3.0/oa/message/cs',
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ access_token: 'acc-new' }),
      }),
    );
  });

  it('sendMessage() throw UnauthorizedException khi connection không tồn tại', async () => {
    connectionRepo.findById.mockResolvedValueOnce(null);
    await expect(
      gateway.sendMessage({ connectionId: 'x', to: 'y', content: 'z' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('listTemplates() gọi Zalo API và map danh sách template', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-1',
      {
        accessToken: 'acc-valid',
        refreshToken: 'ref-1',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    );
    connectionRepo.findById.mockResolvedValueOnce(connection);
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            templateId: 'tpl-1',
            templateName: 'Xác nhận đơn',
            status: 'ENABLE',
          },
          {
            templateId: 'tpl-2',
            templateName: 'Giao hàng',
            status: 'PENDING_REVIEW',
          },
        ],
      },
    });

    const result = await gateway.listTemplates(connection.getUuid());

    expect(result).toEqual([
      { templateId: 'tpl-1', templateName: 'Xác nhận đơn', status: 'ENABLE' },
      {
        templateId: 'tpl-2',
        templateName: 'Giao hàng',
        status: 'PENDING_REVIEW',
      },
    ]);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://business.openapi.zalo.me/template/all',
      expect.objectContaining({
        headers: expect.objectContaining({ access_token: 'acc-valid' }),
      }),
    );
  });

  it('listTemplates() throw BadGatewayException khi Zalo trả lỗi', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-1',
      {
        accessToken: 'acc-valid',
        refreshToken: 'ref-1',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    );
    connectionRepo.findById.mockResolvedValueOnce(connection);
    mockedAxios.get.mockResolvedValueOnce({
      data: { error: 1, message: 'Access token hết hạn' },
    });

    await expect(gateway.listTemplates(connection.getUuid())).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('listTemplates() throw UnauthorizedException khi connection không tồn tại', async () => {
    connectionRepo.findById.mockResolvedValueOnce(null);
    await expect(gateway.listTemplates('x')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  describe('publishTemplate()', () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-1',
      {
        accessToken: 'acc-valid',
        refreshToken: 'ref-1',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    );

    const layout = { body: { components: [{ TITLE: { value: 'Xác nhận đơn hàng' } }] } };
    const params = [{ type: '1', name: 'name', sample_value: 'A' }];

    it('gọi template/create khi template chưa có templateId', async () => {
      connectionRepo.findById.mockResolvedValueOnce(connection);
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: { template_id: 'zns-tpl-99', status: 'PENDING_REVIEW' } },
      });

      const template = ZbsTemplate.createDraft({
        connectionId: connection.getUuid(),
        templateName: 'Xác nhận đơn hàng',
        templateType: '1',
        tag: '1',
        layout,
        params,
        note: 'ghi chú',
        trackingId: 'track-1',
      });

      const result = await gateway.publishTemplate(
        connection.getUuid(),
        template,
      );

      expect(result).toEqual({
        templateId: 'zns-tpl-99',
        status: 'PENDING_REVIEW',
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://business.openapi.zalo.me/template/create',
        expect.objectContaining({
          template_name: 'Xác nhận đơn hàng',
          template_type: '1',
          tag: '1',
          layout,
          params,
          note: 'ghi chú',
          tracking_id: 'track-1',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ access_token: 'acc-valid' }),
        }),
      );
      const sentBody = mockedAxios.post.mock.calls[0][1] as Record<string, any>;
      expect(sentBody.template_id).toBeUndefined();
    });

    it('gọi template/edit kèm template_id khi template đã có templateId', async () => {
      connectionRepo.findById.mockResolvedValueOnce(connection);
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: { template_id: 'zns-tpl-99', status: 'PENDING_REVIEW' } },
      });

      const template = ZbsTemplate.fromSync({
        connectionId: connection.getUuid(),
        templateId: 'zns-tpl-99',
        templateName: 'Xác nhận đơn hàng',
        status: 'ENABLE',
        syncedAt: new Date(),
      });

      const result = await gateway.publishTemplate(
        connection.getUuid(),
        template,
      );

      expect(result).toEqual({
        templateId: 'zns-tpl-99',
        status: 'PENDING_REVIEW',
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://business.openapi.zalo.me/template/edit',
        expect.objectContaining({ template_id: 'zns-tpl-99' }),
        expect.anything(),
      );
    });

    it('throw BadGatewayException khi Zalo không trả về template_id', async () => {
      connectionRepo.findById.mockResolvedValueOnce(connection);
      mockedAxios.post.mockResolvedValueOnce({
        data: { error: 1, message: 'template_name đã tồn tại' },
      });

      const template = ZbsTemplate.createDraft({
        connectionId: connection.getUuid(),
        templateName: 'Xác nhận đơn hàng',
        templateType: '1',
        tag: '1',
        layout,
        params,
      });

      await expect(
        gateway.publishTemplate(connection.getUuid(), template),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
