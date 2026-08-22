// src/modules/merchant/infrastructure/persistence/mappers/merchant.mapper.ts
import { MerchantAggregate } from '@/modules/merchant/domain/models/merchant.aggregate';
import { MerchantCode } from '@/modules/merchant/domain/value-objects/merchant-code.vo';
import { MerchantOrmEntity } from '../entities/merchant.orm-entity';

export class MerchantMapper {
  static toDomain(orm: MerchantOrmEntity): MerchantAggregate {
    return MerchantAggregate.reconstitute({
      id: orm.id ? String(orm.id) : undefined,
      uuid: orm.uuid,
      code: new MerchantCode(orm.code),
      name: orm.name,
      status: orm.status,
      settings: orm.settings,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(domain: MerchantAggregate): Partial<MerchantOrmEntity> {
    return {
      ...(domain.id ? { id: domain.id } : {}),
      uuid: domain.uuid,
      code: domain.code.getValue(),
      name: domain.name,
      status: domain.status,
      settings: domain.settings,
    };
  }
}
