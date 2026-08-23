import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { COOKIE_KEYS } from '../../utils/cookie.util';

@Injectable()
export class SystemJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-system',
) {
  private readonly logger = new Logger(SystemJwtStrategy.name);

  constructor(configService: ConfigService) {
    // ⚠️ LƯU Ý: Phải khớp 100% với biến môi trường trong Token Generator / JwtModule
    const secret =
      configService.get<string>('JWT_SYSTEM_SECRET') ||
      configService.get<string>('JWT_ACCESS_SECRET') ||
      configService.get<string>('JWT_SECRET') ||
      'secret_system';

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          return req?.cookies?.[COOKIE_KEYS.SYSTEM_ACCESS] || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    if (!payload || payload.scope !== 'SYSTEM') {
      throw new UnauthorizedException('Token không có quyền truy cập hệ thống');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      scope: payload.scope,
    };
  }
}