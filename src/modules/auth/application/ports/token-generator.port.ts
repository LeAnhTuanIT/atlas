// src/modules/auth/application/ports/token-generator.port.ts

export const TOKEN_GENERATOR_PORT = Symbol('ITokenGeneratorPort');

export interface TokenPayload {
  userId?: string;
  sub: string;
  scope: 'SYSTEM' | 'MERCHANT' | 'CUSTOMER';
  role?: string;
  email?: string;
  phoneOrEmail?: string;
  merchantId?: string;
  [key: string]: any;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ITokenGeneratorPort {
  generateTokens(payload: TokenPayload): Promise<AuthTokens>;
  verifyRefreshToken(refreshToken: string): Promise<any>;
}
