// src/modules/wallet/presentation/controllers/merchant-wallet.controller.ts
import {
  Controller,
  Get,
  Query,
  Req,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { GetWalletHandler } from '../../application/queries/get-wallet.handler';
import { WALLET_REPOSITORY } from '../../domain/repositories/wallet.repository.interface';
import type { IWalletRepository } from '../../domain/repositories/wallet.repository.interface';
import { COOKIE_KEYS } from '@/shared/infrastructure/utils/cookie.util';

// TODO: Import Guard của dự án nếu có sẵn (ví dụ: MerchantAuthGuard hoặc JwtAuthGuard)
// import { MerchantAuthGuard } from '@/modules/auth/presentation/guards/merchant-auth.guard';

@Controller('merchant/wallet')
// @UseGuards(MerchantAuthGuard) // Mở comment nếu dùng Guard ở cấp Controller
export class MerchantWalletController {
  constructor(
    private readonly getWalletHandler: GetWalletHandler,
    @Inject(WALLET_REPOSITORY)
    private readonly walletRepo: IWalletRepository,
  ) {}

  private extractMerchantId(req: any): string {
    // 1. Lấy từ req.user (khi Guard đã parse)
    let merchantId =
      req.user?.merchantId ||
      req.user?.merchant?.id ||
      req.user?.merchant_id ||
      req.user?.id ||
      req.user?.sub;

    // 2. Lấy từ Headers hoặc Query
    if (!merchantId) {
      merchantId =
        req.headers['x-merchant-id'] ||
        req.headers['x-merchant-uuid'] ||
        req.query?.merchantId;
    }

    // 3. Fallback: Parse từ Cookie Access Token nếu chưa qua Guard
    if (!merchantId && req.cookies) {
      const accessToken =
        req.cookies[COOKIE_KEYS?.MERCHANT_ACCESS || 'merchant_access_token'] ||
        req.cookies?.accessToken;

      if (accessToken && typeof accessToken === 'string') {
        try {
          const base64Payload = accessToken.split('.')[1];
          if (base64Payload) {
            const decoded = JSON.parse(
              Buffer.from(base64Payload, 'base64').toString('utf-8'),
            );
            merchantId = decoded?.merchantId || decoded?.sub;
          }
        } catch {
          // Token không parse được, tiếp tục xử lý bên dưới
        }
      }
    }

    if (!merchantId) {
      throw new UnauthorizedException(
        'Không tìm thấy thông tin Merchant. Vui lòng đăng nhập lại.',
      );
    }

    return String(merchantId);
  }

  @Get(['me', 'balance'])
  async getMyWallet(@Req() req: any) {
    const merchantId = this.extractMerchantId(req);
    return await this.getWalletHandler.execute(merchantId);
  }

  @Get('transactions')
  async getTransactions(
    @Req() req: any,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = 10,
  ) {
    const merchantId = this.extractMerchantId(req);

    const data = await this.walletRepo.findTransactions(
      merchantId,
      cursor,
      Number(limit),
    );

    return {
      data: {
        items: data.items,
        limit: Number(limit),
        hasNextPage: data.hasNextPage,
        nextCursor: data.nextCursor,
      },
    };
  }
}
