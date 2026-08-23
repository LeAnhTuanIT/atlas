import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  ITokenGeneratorPort,
  TokenPayload,
  AuthTokens,
} from '@/modules/auth/application/ports/token-generator.port';

@Injectable()
export class JwtTokenGeneratorAdapter implements ITokenGeneratorPort {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private getSecretByScope(scope: TokenPayload['scope']): string {
    switch (scope) {
      case 'SYSTEM':
        return (
          this.configService.get<string>('JWT_SYSTEM_SECRET') ||
          this.configService.get<string>('JWT_SECRET', 'secret_system')
        );
      case 'MERCHANT':
        return (
          this.configService.get<string>('JWT_MERCHANT_SECRET') ||
          this.configService.get<string>('JWT_SECRET', 'secret_merchant')
        );
      case 'CUSTOMER':
        return (
          this.configService.get<string>('JWT_CUSTOMER_SECRET') ||
          this.configService.get<string>('JWT_SECRET', 'secret_customer')
        );
      default:
        return this.configService.get<string>('JWT_SECRET', 'secret_default');
    }
  }

  async generateTokens(payload: TokenPayload): Promise<AuthTokens> {
    const secret = this.getSecretByScope(payload.scope);

    // Thời gian sống: 15 phút (900 giây)
    const accessExpiresIn = 15 * 60; // 900s
    // Refresh token: 30 ngày
    const refreshExpiresIn = '30d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          sub: payload.sub,
          userId: payload.sub,
          email: payload.email,
          phoneOrEmail: payload.phoneOrEmail,
          scope: payload.scope,
          role: payload.role,
          merchantId: payload.merchantId,
        },
        {
          secret,
          expiresIn: accessExpiresIn, // số nguyên tính bằng giây (900s) hoặc string '15m'
        },
      ),
      this.jwtService.signAsync(
        {
          sub: payload.sub,
          scope: payload.scope,
        },
        {
          secret,
          expiresIn: refreshExpiresIn,
        },
      ),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn,
    };
  }

  async verifyRefreshToken(refreshToken: string, scope: TokenPayload['scope'] = 'SYSTEM'): Promise<any> {
    const secret = this.getSecretByScope(scope);
    try {
      return await this.jwtService.verifyAsync(refreshToken, { secret });
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }
}