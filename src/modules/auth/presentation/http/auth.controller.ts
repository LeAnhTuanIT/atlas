import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Request, Response } from 'express';

import {
  CookieUtil,
  COOKIE_KEYS,
} from '@/shared/infrastructure/utils/cookie.util';
import { UnifiedLoginDto } from '../../application/dtos/unified-login.dto';
import { UnifiedLoginCommand } from '../../application/commands/unified-login/unified-login.command';
import type { UnifiedLoginResult } from '../../application/commands/unified-login/unified-login.handler';
import { RefreshTokenCommand } from '../../application/commands/refresh-token/refresh-token.command';

const SCOPE_COOKIE_KEYS = {
  SYSTEM: {
    access: COOKIE_KEYS.SYSTEM_ACCESS,
    refresh: COOKIE_KEYS.SYSTEM_REFRESH,
  },
  MERCHANT: {
    access: COOKIE_KEYS.MERCHANT_ACCESS,
    refresh: COOKIE_KEYS.MERCHANT_REFRESH,
  },
  CUSTOMER: {
    access: COOKIE_KEYS.CUSTOMER_ACCESS,
    refresh: COOKIE_KEYS.CUSTOMER_REFRESH,
  },
} as const;

@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: UnifiedLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.commandBus.execute<
      UnifiedLoginCommand,
      UnifiedLoginResult
    >(new UnifiedLoginCommand(dto.identifier, dto.password, dto.merchantId));

    const cookieKeys = SCOPE_COOKIE_KEYS[result.scope];
    CookieUtil.setAuthCookies(
      res,
      cookieKeys.access,
      cookieKeys.refresh,
      result.tokens.accessToken,
      result.tokens.refreshToken ?? '',
    );

    return {
      scope: result.scope,
      user: result.user,
      ...(result.merchant && { merchant: result.merchant }),
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Body()
    body: { refreshToken?: string; scope?: 'SYSTEM' | 'MERCHANT' | 'CUSTOMER' },
    @Res({ passthrough: true }) res: Response,
  ) {
    // 1. Quét tất cả các key cookie theo scope hệ thống đã lưu
    const refreshToken =
      req.cookies?.[COOKIE_KEYS.MERCHANT_REFRESH] ||
      req.cookies?.[COOKIE_KEYS.SYSTEM_REFRESH] ||
      req.cookies?.[COOKIE_KEYS.CUSTOMER_REFRESH] ||
      req.cookies?.refreshToken ||
      req.cookies?.refresh_token ||
      body?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Không tìm thấy Refresh Token trong phiên đăng nhập.',
      );
    }

    const result = await this.commandBus.execute<
      RefreshTokenCommand,
      UnifiedLoginResult
    >(new RefreshTokenCommand(refreshToken));

    // 2. Cập nhật lại Cookies mới vào Response
    const cookieKeys = SCOPE_COOKIE_KEYS[result.scope];
    if (cookieKeys && result.tokens) {
      CookieUtil.setAuthCookies(
        res,
        cookieKeys.access,
        cookieKeys.refresh,
        result.tokens.accessToken,
        result.tokens.refreshToken ?? '',
      );
    }

    return {
      scope: result.scope,
      user: result.user,
      ...(result.merchant && { merchant: result.merchant }),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    CookieUtil.clearAuthCookies(
      res,
      COOKIE_KEYS.SYSTEM_ACCESS,
      COOKIE_KEYS.SYSTEM_REFRESH,
    );
    CookieUtil.clearAuthCookies(
      res,
      COOKIE_KEYS.MERCHANT_ACCESS,
      COOKIE_KEYS.MERCHANT_REFRESH,
    );
    CookieUtil.clearAuthCookies(
      res,
      COOKIE_KEYS.CUSTOMER_ACCESS,
      COOKIE_KEYS.CUSTOMER_REFRESH,
    );

    return { message: 'Đăng xuất thành công.' };
  }
}
