import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Inject,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZaloMiniAppLoginCommand } from './zalo-miniapp-login.command';
import { ResolveZaloMiniAppConnectionService } from '@/modules/integrations/application/services/resolve-zalo-miniapp-connection.service';
import { ZaloMiniAppGateway } from '@/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '@/modules/customers/domain/repositories/customer.repository.interface';
import { Customer, CustomerStatus } from '@/modules/customers/domain/models/customer.model';
import { PhoneNumber } from '@/modules/customers/domain/value-objects/phone.vo';
import {
  MerchantOrmEntity,
  MerchantStatus,
} from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import {
  TOKEN_GENERATOR_PORT,
  type ITokenGeneratorPort,
} from '@/modules/auth/application/ports/token-generator.port';
import type { UnifiedLoginResult } from '../unified-login/unified-login.handler';

@CommandHandler(ZaloMiniAppLoginCommand)
export class ZaloMiniAppLoginHandler
  implements ICommandHandler<ZaloMiniAppLoginCommand, UnifiedLoginResult>
{
  constructor(
    private readonly resolveConnection: ResolveZaloMiniAppConnectionService,
    private readonly zaloGateway: ZaloMiniAppGateway,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    @InjectRepository(MerchantOrmEntity)
    private readonly merchantRepository: Repository<MerchantOrmEntity>,
    @Inject(TOKEN_GENERATOR_PORT)
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(command: ZaloMiniAppLoginCommand): Promise<UnifiedLoginResult> {
    const { zaloMiniAppId, uid, accessToken, phoneToken } = command;

    const { merchantId, zaloAppSecret } =
      await this.resolveConnection.resolveByMiniAppId(zaloMiniAppId);

    const merchant = await this.merchantRepository.findOne({
      where: { uuid: merchantId },
    });
    if (!merchant || merchant.status !== MerchantStatus.ACTIVE) {
      throw new ForbiddenException('Merchant hiện không hoạt động.');
    }

    const profile = await this.zaloGateway.getProfile(accessToken);
    if (profile.uid !== uid) {
      throw new UnauthorizedException('Thông tin xác thực Zalo không hợp lệ.');
    }
    const realUid = profile.uid;

    const rawPhone = await this.zaloGateway.getPhoneNumber(
      accessToken,
      phoneToken,
      zaloAppSecret,
    );
    const phone = new PhoneNumber(rawPhone);

    let customer = await this.customerRepository.findByZaloUid(merchantId, realUid);

    if (!customer) {
      const byPhone = await this.customerRepository.findByPhone(merchantId, phone);
      if (byPhone) {
        if (byPhone.zaloUid && byPhone.zaloUid !== realUid) {
          throw new ConflictException(
            'Số điện thoại này đã được liên kết với một tài khoản Zalo khác.',
          );
        }
        byPhone.linkZaloAccount(realUid);
        await this.customerRepository.save(byPhone);
        customer = byPhone;
      } else {
        const created = Customer.create({
          merchantId,
          phone,
          fullName: profile.name || phone.getValue(),
          zaloUid: realUid,
        });
        await this.customerRepository.save(created);
        customer = created;
      }
    }

    if (customer.status === CustomerStatus.BLOCKED) {
      throw new ForbiddenException('Tài khoản đã bị khoá.');
    }

    const tokens = await this.tokenGenerator.generateTokens({
      sub: customer.id.getValue(),
      phoneOrEmail: customer.phone?.getValue(),
      scope: 'CUSTOMER',
      merchantId,
    });

    return {
      scope: 'CUSTOMER',
      tokens,
      user: {
        id: customer.id.getValue(),
        email: customer.email?.getValue(),
        phone: customer.phone?.getValue(),
        fullName: customer.fullName,
        role: 'CUSTOMER',
      },
      merchant: {
        id: merchant.uuid,
        code: merchant.code,
        name: merchant.name,
        status: merchant.status,
      },
    };
  }
}
