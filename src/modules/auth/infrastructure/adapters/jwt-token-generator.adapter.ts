// src/modules/auth/infrastructure/adapters/jwt-token-generator.adapter.ts
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type {
  ITokenGeneratorPort,
  TokenPayload,
  AuthTokens,
} from '../../application/ports/token-generator.port';

@Injectable()
export class JwtTokenGeneratorAdapter implements ITokenGeneratorPort {
  private readonly logger = new Logger(JwtTokenGeneratorAdapter.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async generateTokens(payload: TokenPayload): Promise<AuthTokens> {
    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') || 'access_secret';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') || 'refresh_secret';

    const accessExpiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

    const expiresInSeconds = 15 * 60;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: payload.sub || payload.userId,
          scope: payload.scope,
          role: payload.role,
          merchantId: payload.merchantId,
        },
        {
          secret: accessSecret,
          expiresIn: accessExpiresIn as any,
        },
      ),
      this.jwtService.signAsync(
        {
          sub: payload.sub || payload.userId,
          scope: payload.scope,
        },
        {
          secret: refreshSecret,
          expiresIn: refreshExpiresIn as any,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
    };
  }

  async verifyRefreshToken(refreshToken: string): Promise<any> {
    try {
      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'refresh_secret';

      return await this.jwtService.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch (err: any) {
      this.logger.warn(`Verify JWT thất bại: ${err?.message}`);
      throw new UnauthorizedException(
        'Refresh Token không hợp lệ hoặc đã hết hạn.',
      );
    }
  }
}
