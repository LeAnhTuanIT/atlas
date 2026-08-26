import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const ZALO_GRAPH_ME_URL = 'https://graph.zalo.me/v2.0/me';
const ZALO_GRAPH_ME_INFO_URL = 'https://graph.zalo.me/v2.0/me/info';

export interface ZaloMiniAppProfile {
  uid: string;
  name: string;
  avatar?: string;
}

@Injectable()
export class ZaloMiniAppGateway {
  private readonly logger = new Logger(ZaloMiniAppGateway.name);

  constructor(private readonly configService: ConfigService) {}

  private isMock(): boolean {
    return this.configService.get<string>('ZALO_MINIAPP_MOCK_MODE') === 'true';
  }

  async getProfile(accessToken: string): Promise<ZaloMiniAppProfile> {
    if (this.isMock()) {
      return { uid: `mock_uid_${accessToken}`, name: 'Khách hàng Mock' };
    }

    try {
      const response = await axios.get(ZALO_GRAPH_ME_URL, {
        params: { access_token: accessToken, fields: 'id,name,picture' },
      });

      const data = response.data;
      if (data?.error || !data?.id) {
        this.logger.error(`Zalo Mini App getProfile error: ${JSON.stringify(data)}`);
        throw new BadGatewayException(
          `Zalo từ chối accessToken: ${data?.message || 'unknown error'}`,
        );
      }

      return {
        uid: data.id,
        name: data.name || '',
        avatar: data.picture?.data?.url,
      };
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const errorMsg = error?.response?.data || error?.message;
      this.logger.error(`Lỗi gọi Zalo Mini App getProfile API: ${JSON.stringify(errorMsg)}`);
      throw new BadGatewayException('Không thể xác thực người dùng qua Zalo.');
    }
  }

  async getPhoneNumber(
    accessToken: string,
    phoneToken: string,
    zaloAppSecret: string,
  ): Promise<string> {
    if (this.isMock()) {
      return '84900000000';
    }

    try {
      const response = await axios.get(ZALO_GRAPH_ME_INFO_URL, {
        params: {
          access_token: accessToken,
          code: phoneToken,
          secret_key: zaloAppSecret,
        },
      });

      const data = response.data;
      const number = data?.data?.number;
      if (data?.error || !number) {
        this.logger.error(`Zalo Mini App getPhoneNumber error: ${JSON.stringify(data)}`);
        throw new BadGatewayException(
          `Zalo từ chối giải mã số điện thoại: ${data?.message || 'unknown error'}`,
        );
      }

      return number;
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const errorMsg = error?.response?.data || error?.message;
      this.logger.error(`Lỗi gọi Zalo Mini App getPhoneNumber API: ${JSON.stringify(errorMsg)}`);
      throw new BadGatewayException('Không thể lấy số điện thoại từ Zalo.');
    }
  }
}
