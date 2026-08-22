// src/modules/auth/application/commands/refresh-token/refresh-token.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RefreshTokenCommand } from './refresh-token.command';
import type { UnifiedLoginResult } from '../unified-login/unified-login.handler';
import {
  TOKEN_GENERATOR_PORT,
  type ITokenGeneratorPort,
} from '@/modules/auth/application/ports/token-generator.port';
import { SystemUserOrmEntity } from '@/modules/system-user/infrastructure/persistence/entities/system-user.orm-entity';
import { MerchantUserOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant-user.orm-entity';
import { CustomerOrmEntity } from '@/modules/customers/infrastructure/persistence/entities/customer.orm-entity';

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<
  RefreshTokenCommand,
  UnifiedLoginResult
> {
  private readonly logger = new Logger(RefreshTokenHandler.name);

  constructor(
    @Inject(TOKEN_GENERATOR_PORT)
    private readonly tokenGenerator: ITokenGeneratorPort,
    @InjectRepository(SystemUserOrmEntity)
    private readonly systemUserRepo: Repository<SystemUserOrmEntity>,
    @InjectRepository(MerchantUserOrmEntity)
    private readonly merchantUserRepo: Repository<MerchantUserOrmEntity>,
    @InjectRepository(CustomerOrmEntity)
    private readonly customerRepo: Repository<CustomerOrmEntity>,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<UnifiedLoginResult> {
    const { refreshToken } = command;

    if (!refreshToken) {
      throw new UnauthorizedException('Không tìm thấy Refresh Token.');
    }

    try {
      // 1. Verify Refresh Token
      const payload =
        await this.tokenGenerator.verifyRefreshToken(refreshToken);

      if (!payload || !payload.sub || !payload.scope) {
        throw new UnauthorizedException('Payload token không hợp lệ.');
      }

      const identifier = String(payload.sub);
      const isNumeric = /^\d+$/.test(identifier);

      let user: any = null;
      let merchantInfo: any = undefined;

      // 2. Tìm entity theo UUID hoặc ID
      if (payload.scope === 'SYSTEM') {
        const queryCondition = isNumeric
          ? { id: identifier as any, isActive: true }
          : { uuid: identifier, isActive: true };

        const sysUser = await this.systemUserRepo.findOne({
          where: queryCondition,
        });

        if (!sysUser) {
          throw new UnauthorizedException(
            'Tài khoản System không tồn tại hoặc đã bị khóa.',
          );
        }

        user = {
          id: sysUser.uuid,
          email: sysUser.email,
          fullName: sysUser.fullName,
          role: sysUser.role,
        };
      } else if (payload.scope === 'MERCHANT') {
        // FIX: Ưu tiên tìm theo uuid nếu sub là chuỗi UUID
        const queryCondition = isNumeric
          ? { id: identifier as any, isActive: true }
          : { uuid: identifier, isActive: true };

        const merchantUser = await this.merchantUserRepo.findOne({
          where: queryCondition,
          relations: { merchant: true },
        });

        if (!merchantUser) {
          throw new UnauthorizedException(
            'Tài khoản Merchant không tồn tại hoặc đã bị khóa.',
          );
        }

        user = {
          id: merchantUser.uuid,
          email: merchantUser.email,
          fullName: merchantUser.fullName,
          role: merchantUser.role,
        };

        if (merchantUser.merchant) {
          merchantInfo = {
            id: merchantUser.merchant.uuid,
            code: merchantUser.merchant.code,
            name: merchantUser.merchant.name,
          };
        }
      } else if (payload.scope === 'CUSTOMER') {
        const queryCondition = isNumeric
          ? { id: identifier as any }
          : { uuid: identifier };

        const customer = await this.customerRepo.findOne({
          where: queryCondition,
        });

        if (!customer) {
          throw new UnauthorizedException('Khách hàng không tồn tại.');
        }

        user = {
          id: customer.uuid,
          phone: customer.phone,
          fullName: customer.fullName,
          role: 'CUSTOMER',
        };
      }

      // 3. Cấp cặp token mới với sub giữ nguyên định dạng UUID của user
      const tokens = await this.tokenGenerator.generateTokens({
        userId: user.id,
        sub: user.id,
        scope: payload.scope,
        role: user.role,
        merchantId: merchantInfo?.id,
      });

      return {
        scope: payload.scope,
        user,
        ...(merchantInfo && { merchant: merchantInfo }),
        tokens,
      };
    } catch (error: any) {
      this.logger.error(`Lỗi Refresh Token chi tiết: ${error?.message}`);

      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException(
        error?.message || 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.',
      );
    }
  }
}
