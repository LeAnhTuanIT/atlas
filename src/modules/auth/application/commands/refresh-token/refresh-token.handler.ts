// refresh-token.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException } from '@nestjs/common';
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
export class RefreshTokenHandler
  implements ICommandHandler<RefreshTokenCommand, UnifiedLoginResult>
{
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

    try {
      // 1. Verify Refresh Token qua Token Generator Port
      const payload = await this.tokenGenerator.verifyRefreshToken(refreshToken);

      if (!payload || !payload.sub || !payload.scope) {
        throw new UnauthorizedException('Payload token không hợp lệ.');
      }

      // 2. Kiểm tra entity tương ứng trong DB còn active không
      let user: any = null;
      let merchantInfo: any = undefined;

      if (payload.scope === 'SYSTEM') {
        const sysUser = await this.systemUserRepo.findOne({
          where: { id: payload.sub, isActive: true },
        });
        if (!sysUser) throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
        user = {
          id: sysUser.id,
          email: sysUser.email,
          fullName: sysUser.fullName,
          role: sysUser.role,
        };
      } else if (payload.scope === 'MERCHANT') {
        const merchantUser = await this.merchantUserRepo.findOne({
          where: { id: payload.sub, isActive: true },
          relations: { merchant: true },
        });
        if (!merchantUser) throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
        user = {
          id: merchantUser.id,
          email: merchantUser.email,
          fullName: merchantUser.fullName,
          role: merchantUser.role,
        };
        if (merchantUser.merchant) {
          merchantInfo = {
            id: merchantUser.merchant.id,
            code: merchantUser.merchant.code,
            name: merchantUser.merchant.name,
          };
        }
      } else if (payload.scope === 'CUSTOMER') {
        const customer = await this.customerRepo.findOne({
          where: { id: payload.sub },
        });
        if (!customer) throw new UnauthorizedException('Khách hàng không tồn tại hoặc đã bị khóa.');
        user = {
          id: customer.id,
          phone: customer.phone,
          fullName: customer.fullName,
          role: 'CUSTOMER',
        };
      }

      // 3. Cấp cặp Access Token & Refresh Token mới
      const tokens = await this.tokenGenerator.generateTokens({
          userId: user.id,
          scope: payload.scope,
          role: user.role,
          merchantId: merchantInfo?.id,
          sub: ''
      });

      return {
        scope: payload.scope,
        user,
        ...(merchantInfo && { merchant: merchantInfo }),
        tokens,
      };
    } catch (error) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn hoặc không hợp lệ.');
    }
  }
}