// src/modules/merchant/application/commands/handlers/create-merchant.handler.ts
import {
  Injectable,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import {
  MerchantUserOrmEntity,
  MerchantUserRole,
} from '@/modules/merchant/infrastructure/persistence/entities/merchant-user.orm-entity';
import { MerchantStatus } from '@/modules/merchant/domain/models/merchant.aggregate';
import { CreateMerchantDto } from '../../dtos/create-merchant.dto';
import {
  PASSWORD_HASHER_PORT,
  type IPasswordHasherPort,
} from '@/modules/auth/application/ports/password-hasher.port';

@Injectable()
export class CreateMerchantUseCase {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(PASSWORD_HASHER_PORT)
    private readonly hasher: IPasswordHasherPort,
  ) {}

  async execute(dto: CreateMerchantDto) {
    const { code, name, settings, phone, adminPhone, address } = dto;

    // Lấy thông tin admin theo fallback
    const targetEmail = dto.email || dto.adminEmail;
    const targetPassword = dto.password || dto.adminPassword || 'Merchant123@';
    const targetFullName = dto.fullName || dto.adminFullName || name;
    const targetPhone = phone || adminPhone;

    if (!targetEmail) {
      throw new BadRequestException(
        'Email quản trị Merchant không được để trống.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 1. Check trùng code
      const existingMerchant = await manager.findOne(MerchantOrmEntity, {
        where: { code },
      });
      if (existingMerchant) {
        throw new ConflictException(`Mã Merchant '${code}' đã tồn tại.`);
      }

      // 2. Check trùng email
      const existingUser = await manager.findOne(MerchantUserOrmEntity, {
        where: { email: targetEmail },
      });
      if (existingUser) {
        throw new ConflictException(`Email '${targetEmail}' đã được sử dụng.`);
      }

      // 3. Lưu Merchant
      const merchant = manager.create(MerchantOrmEntity, {
        uuid: crypto.randomUUID(),
        code,
        name,
        status: MerchantStatus.ACTIVE,
        settings: {
          ...settings,
          ...(targetPhone && { phone: targetPhone }),
          ...(address && { address }),
        },
      });
      const savedMerchant = await manager.save(MerchantOrmEntity, merchant);

      // 4. Lưu Merchant User (Owner)
      const passwordHash = await this.hasher.hash(targetPassword);
      const merchantUser = manager.create(MerchantUserOrmEntity, {
        uuid: crypto.randomUUID(),
        merchantId: savedMerchant.uuid,
        email: targetEmail,
        fullName: targetFullName,
        role: MerchantUserRole.OWNER,
        isActive: true,
        passwordHash,
      });
      await manager.save(MerchantUserOrmEntity, merchantUser);

      return {
        id: savedMerchant.uuid,
        code: savedMerchant.code,
        name: savedMerchant.name,
        status: savedMerchant.status,
        owner: {
          email: merchantUser.email,
          fullName: merchantUser.fullName,
        },
      };
    });
  }
}
