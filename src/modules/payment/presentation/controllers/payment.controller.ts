// src/modules/payment/presentation/controllers/payment.controller.ts
import {
  Controller,
  Post,
  Body,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { CreateDepositOrderHandler } from '../../application/commands/create-deposit-order.handler';
import { CreateDepositOrderCommand } from '../../application/commands/create-deposit-order.command';
import { PaymentGatewayEnum } from '../../domain/value-objects/payment-status.vo';
import { COOKIE_KEYS } from '@/shared/infrastructure/utils/cookie.util';

// Regex chuẩn kiểm tra chuỗi định dạng UUID (v1-v5)
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Controller('merchant/wallet')
export class PaymentController {
  constructor(
    private readonly createDepositHandler: CreateDepositOrderHandler,
  ) {}

  private isUuid(val: any): boolean {
    return typeof val === 'string' && UUID_REGEX.test(val.trim());
  }

  private extractMerchantId(req: any): string {
    let merchantId: string | undefined;

    // 1. Lấy từ req.user (Ưu tiên các field chứa UUID)
    const user = req.user;
    if (user) {
      const candidates = [
        user.merchant?.uuid,
        user.merchantUuid,
        user.merchant_uuid,
        user.merchantId,
        user.merchant?.id,
        user.merchant_id,
        user.id,
        user.sub,
      ];
      merchantId = candidates.find((id) => this.isUuid(id));
    }

    // 2. Lấy từ Headers
    if (!merchantId) {
      const headerCandidates = [
        req.headers['x-merchant-uuid'],
        req.headers['x-merchant-id'],
        req.headers['merchant-id'],
      ];
      merchantId = headerCandidates.find((id) => this.isUuid(id));
    }

    // 3. Fallback: Parse từ Cookie Access Token
    if (!merchantId && req.cookies) {
      const accessToken =
        req.cookies[COOKIE_KEYS?.MERCHANT_ACCESS || 'merchant_access_token'] ||
        req.cookies?.merchant_access_token ||
        req.cookies?.accessToken;

      if (accessToken && typeof accessToken === 'string') {
        try {
          const base64Payload = accessToken.split('.')[1];
          if (base64Payload) {
            const decoded = JSON.parse(
              Buffer.from(base64Payload, 'base64').toString('utf-8'),
            );
            const jwtCandidates = [
              decoded?.merchantUuid,
              decoded?.merchant_uuid,
              decoded?.merchantId,
              decoded?.merchant_id,
              decoded?.sub,
              decoded?.id,
            ];
            merchantId = jwtCandidates.find((id) => this.isUuid(id));
          }
        } catch {
          // Bỏ qua lỗi giải mã payload
        }
      }
    }

    // 4. Validate kết quả cuối cùng
    if (!merchantId || !this.isUuid(merchantId)) {
      throw new UnauthorizedException(
        'Không tìm thấy định dạng UUID Merchant hợp lệ. Vui lòng đăng nhập lại.',
      );
    }

    return merchantId.trim().toLowerCase();
  }

  @Post('deposit')
  async createDeposit(
    @Req() req: any,
    @Body()
    body: {
      amount: number;
      gateway: PaymentGatewayEnum;
      returnUrl: string;
    },
  ) {
    const merchantId = this.extractMerchantId(req);

    return await this.createDepositHandler.execute(
      new CreateDepositOrderCommand(
        merchantId,
        req.user?.merchant?.name || '',
        req.user?.merchant?.code || '',
        Number(body.amount),
        body.gateway,
        body.returnUrl,
      ),
    );
  }
}
