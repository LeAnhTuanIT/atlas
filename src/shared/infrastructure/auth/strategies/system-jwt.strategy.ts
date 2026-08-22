import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { COOKIE_KEYS } from '../../utils/cookie.util';

@Injectable()
export class SystemJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-system',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: (req: Request) => {
        return req?.cookies?.[COOKIE_KEYS.SYSTEM_ACCESS] || null;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_SYSTEM_SECRET',
        'secret_system',
      ),
    });
  }

  validate(payload: any) {
    const uuid = payload.merchantUuid || payload.merchantId || payload.sub;

    return {
      userId: payload.sub,
      merchantId: uuid,
      merchantUuid: uuid,
      role: payload.role,
      scope: payload.scope,
    };
  }
}
