export interface ExchangedToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // giây
}

export interface IOAuthConnectable {
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<ExchangedToken>;
  refreshAccessToken(refreshToken: string): Promise<ExchangedToken>;
}
