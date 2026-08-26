import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException } from '@nestjs/common';
import { ZaloMiniAppGateway } from './zalo-miniapp.gateway';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZaloMiniAppGateway', () => {
  const configService = {
    get: jest.fn(() => undefined),
  } as unknown as ConfigService;

  const gateway = new ZaloMiniAppGateway(configService);

  beforeEach(() => jest.clearAllMocks());

  describe('getProfile', () => {
    it('trả về uid/name/avatar khi Zalo phản hồi thành công', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { id: 'zalo-uid-1', name: 'Nguyễn Văn A', picture: { data: { url: 'http://x/avatar.png' } } },
      });

      const profile = await gateway.getProfile('acc-token');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.zalo.me/v2.0/me',
        expect.objectContaining({
          params: { access_token: 'acc-token', fields: 'id,name,picture' },
        }),
      );
      expect(profile).toEqual({
        uid: 'zalo-uid-1',
        name: 'Nguyễn Văn A',
        avatar: 'http://x/avatar.png',
      });
    });

    it('ném BadGatewayException khi Zalo trả lỗi (accessToken invalid)', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { error: -216, message: 'Access token is invalid' },
      });

      await expect(gateway.getProfile('bad-token')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('ném BadGatewayException khi gọi Zalo API lỗi network', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('timeout'));

      await expect(gateway.getProfile('acc-token')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('getPhoneNumber', () => {
    it('trả về số điện thoại khi giải mã thành công', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { number: '84912345678' } },
      });

      const phone = await gateway.getPhoneNumber(
        'acc-token',
        'phone-token',
        'app-secret',
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.zalo.me/v2.0/me/info',
        expect.objectContaining({
          params: {
            access_token: 'acc-token',
            code: 'phone-token',
            secret_key: 'app-secret',
          },
        }),
      );
      expect(phone).toBe('84912345678');
    });

    it('ném BadGatewayException khi phoneToken hết hạn/sai', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { error: -230, message: 'Invalid code' },
      });

      await expect(
        gateway.getPhoneNumber('acc-token', 'bad-token', 'app-secret'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
