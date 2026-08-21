// infrastructure/persistence/typeorm/entitlement.typeorm.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { IEntitlementRepository } from '../../../domain/repositories/entitlement.repository.interface';
import { ShopEntitlement } from '../../../domain/models/shop-entitlement.entity';
import { ShopEntitlementOrmEntity } from './entities/shop-entitlement.orm-entity';
import { EntitlementMapper } from '../../mappers/entitlement.mapper';

@Injectable()
export class EntitlementTypeormRepository implements IEntitlementRepository {
  constructor(
    @InjectRepository(ShopEntitlementOrmEntity)
    private readonly ormRepo: Repository<ShopEntitlementOrmEntity>,
  ) {}

  async findByShopAndFeature(shopId: string, featureCode: string): Promise<ShopEntitlement | null> {
    const record = await this.ormRepo.findOne({
      where: { shopId, featureId: featureCode.toUpperCase() },
    });
    return record ? EntitlementMapper.toDomain(record) : null;
  }

  async findActiveByShop(shopId: string): Promise<ShopEntitlement[]> {
    const records = await this.ormRepo.find({
      where: {
        shopId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
    });
    return records.map(EntitlementMapper.toDomain);
  }

  async save(entitlement: ShopEntitlement): Promise<void> {
    const ormEntity = EntitlementMapper.toOrm(entitlement);
    await this.ormRepo.save(ormEntity);
  }
}