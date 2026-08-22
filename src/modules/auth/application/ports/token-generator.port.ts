export const TOKEN_GENERATOR_PORT = Symbol('TOKEN_GENERATOR_PORT');

export interface TokenPayload {
  sub: string;
  merchantId?: string;
  role?: string;
  email?: string;
  [key: string]: any;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface ITokenGeneratorPort {
  generateTokens(payload: TokenPayload): Promise<AuthTokens>;
  verifyToken<T extends object = TokenPayload>(token: string): Promise<T>;
  verifyRefreshToken<T extends object = TokenPayload>(
    token: string,
  ): Promise<T>;
}
