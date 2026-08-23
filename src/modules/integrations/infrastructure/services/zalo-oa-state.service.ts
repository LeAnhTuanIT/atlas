import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface ZaloOaStatePayload {
  merchantId: string;
}

@Injectable()
export class ZaloOaStateService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signState(merchantId: string): Promise<string> {
    const secret = this.configService.getOrThrow<string>(
      'ZALO_OA_STATE_SECRET',
    );
    return this.jwtService.signAsync(
      { merchantId },
      { secret, expiresIn: '5m' },
    );
  }

  async verifyState(state: string): Promise<ZaloOaStatePayload> {
    const secret = this.configService.getOrThrow<string>(
      'ZALO_OA_STATE_SECRET',
    );
    try {
      const payload = await this.jwtService.verifyAsync<ZaloOaStatePayload>(
        state,
        { secret },
      );
      return { merchantId: payload.merchantId };
    } catch {
      throw new UnauthorizedException(
        'Liên kết Zalo OA không hợp lệ hoặc đã hết hạn, vui lòng thử lại.',
      );
    }
  }
}
