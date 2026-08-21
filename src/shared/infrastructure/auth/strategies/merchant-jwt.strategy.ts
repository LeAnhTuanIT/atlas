import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { MerchantJwtPayload } from '../auth-payloads.interface';
import { MerchantContext } from '../../context/merchant-context';
import { COOKIE_KEYS } from '../../utils/cookie.util';

@Injectable()
export class MerchantJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-merchant',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => {
        return req?.cookies?.[COOKIE_KEYS.MERCHANT_ACCESS] || null;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_MERCHANT_SECRET',
        'secret_merchant',
      ),
    });
  }

  validate(payload: MerchantJwtPayload) {
    if (payload.scope !== 'MERCHANT' || !payload.merchantId) {
      throw new UnauthorizedException('Token không hợp lệ cho Merchant.');
    }

    MerchantContext.run(
      {
        userId: payload.sub,
        merchantId: payload.merchantId,
        role: payload.role,
      },
      () => {},
    );

    return payload;
  }
}
