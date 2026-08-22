// src/shared/infrastructure/utils/cookie.util.ts
import { CookieOptions, Response } from 'express';

export const COOKIE_KEYS = {
  SYSTEM_ACCESS: 'sys_access_token',
  SYSTEM_REFRESH: 'sys_refresh_token',
  MERCHANT_ACCESS: 'mc_access_token',
  MERCHANT_REFRESH: 'mc_refresh_token',
  CUSTOMER_ACCESS: 'cus_access_token',
  CUSTOMER_REFRESH: 'cus_refresh_token',
} as const;

export const getBaseCookieOptions = (): CookieOptions => {
  const isProd = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    // Nếu production chung root domain (vd: app.domain.com và api.domain.com), bỏ comment dòng dưới:
    // domain: isProd ? process.env.COOKIE_DOMAIN || undefined : undefined,
  };
};

export class CookieUtil {
  static setAuthCookies(
    res: Response,
    accessKey: string,
    refreshKey: string,
    accessToken: string,
    refreshToken: string,
  ) {
    const baseOptions = getBaseCookieOptions();

    res.cookie(accessKey, accessToken, {
      ...baseOptions,
      maxAge: 15 * 60 * 1000,
    });

    if (refreshToken) {
      res.cookie(refreshKey, refreshToken, {
        ...baseOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
  }

  static clearAuthCookies(
    res: Response,
    accessKey: string,
    refreshKey: string,
  ) {
    const baseOptions = getBaseCookieOptions();

    res.clearCookie(accessKey, baseOptions);
    res.clearCookie(refreshKey, baseOptions);
  }
}
