import {
  Inject,
  Injectable,
  Logger,
  BadGatewayException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  IMessagingGateway,
  SendMessageParams,
  SendMessageResult,
} from '../../domain/services/messaging-gateway.interface';
import type {
  ExchangedToken,
  IOAuthConnectable,
} from '../../domain/services/oauth-connectable.interface';
import { IntegrationProviderEnum } from '../../domain/value-objects/integration-provider.vo';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '../../domain/repositories/integration-connection.repository.interface';

const ZALO_OAUTH_TOKEN_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';
const ZALO_OAUTH_PERMISSION_URL = 'https://oauth.zaloapp.com/v4/oa/permission';
const ZALO_SEND_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';

@Injectable()
export class ZaloOaGateway implements IMessagingGateway, IOAuthConnectable {
  private readonly logger = new Logger(ZaloOaGateway.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
  ) {}

  getProvider(): IntegrationProviderEnum {
    return IntegrationProviderEnum.ZALO_OA;
  }

  getAuthUrl(state: string): string {
    const appId = this.configService.getOrThrow<string>('ZALO_OA_APP_ID');
    const redirectUri = this.configService.getOrThrow<string>(
      'ZALO_OA_REDIRECT_URI',
    );
    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      state,
    });
    return `${ZALO_OAUTH_PERMISSION_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<ExchangedToken> {
    const appId = this.configService.getOrThrow<string>('ZALO_OA_APP_ID');
    const secretKey = this.configService.getOrThrow<string>(
      'ZALO_OA_SECRET_KEY',
    );

    const body = new URLSearchParams({
      app_id: appId,
      code,
      grant_type: 'authorization_code',
    });

    return this.callTokenEndpoint(body, secretKey);
  }

  async refreshAccessToken(refreshToken: string): Promise<ExchangedToken> {
    const appId = this.configService.getOrThrow<string>('ZALO_OA_APP_ID');
    const secretKey = this.configService.getOrThrow<string>(
      'ZALO_OA_SECRET_KEY',
    );

    const body = new URLSearchParams({
      app_id: appId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    return this.callTokenEndpoint(body, secretKey);
  }

  private async callTokenEndpoint(
    body: URLSearchParams,
    secretKey: string,
  ): Promise<ExchangedToken> {
    try {
      const response = await axios.post(ZALO_OAUTH_TOKEN_URL, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          secret_key: secretKey,
        },
      });

      const data = response.data;
      if (!data?.access_token || !data?.refresh_token) {
        this.logger.error(`Zalo OA token error: ${JSON.stringify(data)}`);
        throw new BadGatewayException(
          `Zalo trả về lỗi khi lấy access token: ${data?.error_description || 'unknown error'}`,
        );
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: Number(data.expires_in),
      };
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const errorMsg = error?.response?.data || error?.message;
      this.logger.error(
        `Lỗi gọi Zalo OA token API: ${JSON.stringify(errorMsg)}`,
      );
      throw new BadGatewayException('Không thể kết nối tới Zalo OA.');
    }
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const connection = await this.connectionRepo.findById(params.connectionId);
    if (!connection) {
      throw new UnauthorizedException(
        'Chưa liên kết Zalo OA hoặc liên kết không tồn tại.',
      );
    }

    let accessToken = connection.getAccessToken();
    if (connection.isTokenExpiringSoon() && connection.getRefreshToken()) {
      const refreshed = await this.refreshAccessToken(
        connection.getRefreshToken()!,
      );
      connection.updateTokens({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      });
      await this.connectionRepo.save(connection);
      accessToken = refreshed.accessToken;
    }

    if (!accessToken) {
      throw new UnauthorizedException(
        'Liên kết Zalo OA chưa có access token hợp lệ.',
      );
    }

    try {
      const response = await axios.post(
        ZALO_SEND_MESSAGE_URL,
        {
          recipient: { user_id: params.to },
          message: { text: params.content },
        },
        { headers: { access_token: accessToken } },
      );

      const messageId = response.data?.data?.message_id;
      if (!messageId) {
        this.logger.error(
          `Zalo OA send message error: ${JSON.stringify(response.data)}`,
        );
        throw new BadGatewayException(
          `Zalo từ chối gửi tin: ${response.data?.message || 'unknown error'}`,
        );
      }

      return { externalMessageId: messageId };
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const errorMsg = error?.response?.data || error?.message;
      this.logger.error(
        `Lỗi gọi Zalo OA send message API: ${JSON.stringify(errorMsg)}`,
      );
      throw new BadGatewayException('Không thể gửi tin nhắn qua Zalo OA.');
    }
  }
}
