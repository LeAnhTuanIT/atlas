import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthTokens,
  ITokenGeneratorPort,
  TokenPayload,
} from '@/modules/auth/application/ports/token-generator.port';

@Injectable()
export class JwtTokenGeneratorAdapter implements ITokenGeneratorPort {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
  verifyRefreshToken<T extends object = TokenPayload>(
    _token: string,
  ): Promise<T> {
    throw new Error('Method not implemented.');
  }

  async generateTokens(payload: TokenPayload): Promise<AuthTokens> {
    const ttlSeconds = this.configService.get<number>(
      'JWT_ACCESS_TTL_SECONDS',
      900,
    );
    const secret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'default-secret-key';
    const refreshTtlSeconds = this.configService.get<number>(
      'JWT_REFRESH_TTL_SECONDS',
      30 * 24 * 60 * 60,
    );
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'default-refresh-secret-key';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { secret, expiresIn: ttlSeconds }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshTtlSeconds,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: ttlSeconds,
    };
  }

  async verifyToken<T extends object = TokenPayload>(
    token: string,
  ): Promise<T> {
    const secret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'default-secret-key';
    return this.jwtService.verifyAsync<T>(token, { secret });
  }
}
