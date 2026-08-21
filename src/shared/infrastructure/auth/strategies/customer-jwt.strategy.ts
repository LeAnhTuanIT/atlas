// customer-jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { CustomerJwtPayload } from '../auth-payloads.interface';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-customer',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>(
        'JWT_CUSTOMER_SECRET',
        'secret_customer_key',
      ),
    });
  }

  validate(payload: CustomerJwtPayload) {
    if (payload.scope !== 'CUSTOMER' || !payload.merchantId) {
      throw new UnauthorizedException(
        'Token không hợp lệ cho phân quyền Khách hàng.',
      );
    }
    return payload;
  }
}
