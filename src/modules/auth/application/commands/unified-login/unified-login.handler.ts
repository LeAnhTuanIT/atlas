import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnifiedLoginCommand } from './unified-login.command';
import {
  PASSWORD_HASHER_PORT,
  type IPasswordHasherPort,
} from '@/modules/auth/application/ports/password-hasher.port';
import {
  TOKEN_GENERATOR_PORT,
  type ITokenGeneratorPort,
  type AuthTokens,
} from '@/modules/auth/application/ports/token-generator.port';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '@/modules/customers/domain/repositories/customer.repository.interface';
import { Customer } from '@/modules/customers/domain/models/customer.model';
import { PhoneNumber } from '@/modules/customers/domain/value-objects/phone.vo';
import { Email } from '@/modules/customers/domain/value-objects/email.vo';
import { SystemUserOrmEntity } from '@/modules/system-user/infrastructure/persistence/entities/system-user.orm-entity';
import { MerchantUserOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant-user.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';

export interface UnifiedLoginResult {
  scope: 'SYSTEM' | 'MERCHANT' | 'CUSTOMER';
  tokens: AuthTokens;
  user: {
    id: string;
    email?: string;
    phone?: string;
    fullName: string;
    role: string;
  };
  merchant?: {
    id: string;
    code: string;
    name: string;
    status: string;
  };
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@CommandHandler(UnifiedLoginCommand)
export class UnifiedLoginHandler implements ICommandHandler<
  UnifiedLoginCommand,
  UnifiedLoginResult
> {
  constructor(
    @Inject(PASSWORD_HASHER_PORT)
    private readonly passwordHasher: IPasswordHasherPort,
    @Inject(TOKEN_GENERATOR_PORT)
    private readonly tokenGenerator: ITokenGeneratorPort,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    @InjectRepository(SystemUserOrmEntity)
    private readonly systemUserRepository: Repository<SystemUserOrmEntity>,
    @InjectRepository(MerchantUserOrmEntity)
    private readonly merchantUserRepository: Repository<MerchantUserOrmEntity>,
    @InjectRepository(MerchantOrmEntity)
    private readonly merchantRepository: Repository<MerchantOrmEntity>,
  ) {}

  async execute(command: UnifiedLoginCommand): Promise<UnifiedLoginResult> {
    const { identifier, password, merchantId } = command;
    const invalidCredentials = () =>
      new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');

    const isValidMerchantUuid = merchantId && UUID_REGEX.test(merchantId);

    // 1. Thử tài khoản Hệ thống (System)
    const systemUser = await this.systemUserRepository.findOne({
      where: { email: identifier, isActive: true },
      select: {
        id: true,
        uuid: true,
        email: true,
        fullName: true,
        role: true,
        passwordHash: true,
      },
    });
    if (systemUser) {
      await this.verifyPassword(
        password,
        systemUser.passwordHash,
        invalidCredentials,
      );
      const tokens = await this.tokenGenerator.generateTokens({
        sub: systemUser.uuid,
        email: systemUser.email,
        scope: 'SYSTEM',
        role: systemUser.role,
      });
      return {
        scope: 'SYSTEM',
        tokens,
        user: {
          id: systemUser.uuid,
          email: systemUser.email,
          fullName: systemUser.fullName,
          role: systemUser.role,
        },
      };
    }

    // 2. Thử tài khoản Merchant (Owner/Admin/Staff)
    const merchantUser = await this.merchantUserRepository.findOne({
      where: {
        email: identifier,
        isActive: true,
        ...(isValidMerchantUuid && { merchantId }),
      },
      select: {
        id: true,
        uuid: true,
        merchantId: true,
        email: true,
        fullName: true,
        role: true,
        passwordHash: true,
      },
    });
    if (merchantUser) {
      await this.verifyPassword(
        password,
        merchantUser.passwordHash,
        invalidCredentials,
      );
      const merchant = await this.merchantRepository.findOne({
        where: { uuid: merchantUser.merchantId },
      });
      const tokens = await this.tokenGenerator.generateTokens({
        sub: merchantUser.uuid,
        email: merchantUser.email,
        scope: 'MERCHANT',
        merchantId: merchantUser.merchantId,
        role: merchantUser.role,
      });
      return {
        scope: 'MERCHANT',
        tokens,
        user: {
          id: merchantUser.uuid,
          email: merchantUser.email,
          fullName: merchantUser.fullName,
          role: merchantUser.role,
        },
        ...(merchant && {
          merchant: {
            id: merchant.uuid,
            code: merchant.code,
            name: merchant.name,
            status: merchant.status,
          },
        }),
      };
    }

    // 3. Thử tài khoản Customer (Chỉ query khi có merchantId hợp lệ dạng UUID)
    if (isValidMerchantUuid && merchantId) {
      let customer: Customer | null = null;

      try {
        customer = await this.customerRepository.findByPhone(
          merchantId,
          new PhoneNumber(identifier),
        );
      } catch {
        // Bỏ qua nếu không đúng format SĐT
      }

      if (!customer) {
        try {
          customer = await this.customerRepository.findByEmail(
            merchantId,
            new Email(identifier),
          );
        } catch {
          // Bỏ qua nếu không đúng format Email
        }
      }

      if (customer) {
        await this.verifyPassword(
          password,
          customer.passwordHash,
          invalidCredentials,
        );

        const merchant = await this.merchantRepository.findOne({
          where: { uuid: customer.merchantId },
        });
        const tokens = await this.tokenGenerator.generateTokens({
          sub: customer.id.getValue(),
          phoneOrEmail: identifier,
          scope: 'CUSTOMER',
          merchantId: merchant?.uuid,
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
          ...(merchant && {
            merchant: {
              id: merchant.uuid,
              code: merchant.code,
              name: merchant.name,
              status: merchant.status,
            },
          }),
        };
      }
    }
    throw invalidCredentials();
  }

  private async verifyPassword(
    password: string | undefined,
    passwordHash: string | undefined,
    onFailure: () => Error,
  ): Promise<void> {
    if (!passwordHash || !password) {
      throw onFailure();
    }
    const isMatch = await this.passwordHasher.compare(password, passwordHash);
    if (!isMatch) {
      throw onFailure();
    }
  }
}