// Ví dụ: merchant-jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { COOKIE_KEYS } from '@/shared/infrastructure/utils/cookie.util';

@Injectable()
export class MerchantJwtStrategy extends PassportStrategy(
  Strategy,
  'merchant-jwt',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          return (
            req?.cookies?.[COOKIE_KEYS?.MERCHANT_ACCESS] ||
            req?.cookies?.merchant_access_token ||
            req?.cookies?.accessToken ||
            null
          );
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') || 'access_secret',
    });
  }

  validate(payload: any) {
    if (!payload || payload.scope !== 'MERCHANT') {
      throw new UnauthorizedException(
        'Token không có quyền truy cập Merchant.',
      );
    }
    return {
      id: payload.sub || payload.userId,
      merchantId: payload.merchantId,
      email: payload.email,
      role: payload.role,
      scope: payload.scope,
    };
  }
}
