// infrastructure/persistence/typeorm/entitlement.typeorm.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { IEntitlementRepository } from '../../../domain/repositories/entitlement.repository.interface';
import { ShopEntitlement } from '../../../domain/models/shop-entitlement.entity';
import { ShopEntitlementOrmEntity } from './entities/shop-entitlement.orm-entity';
import { FeatureOrmEntity } from './entities/feature.orm-entity';
import { EntitlementMapper } from '../../mappers/entitlement.mapper';

@Injectable()
export class EntitlementTypeormRepository implements IEntitlementRepository {
  constructor(
    @InjectRepository(ShopEntitlementOrmEntity)
    private readonly ormRepo: Repository<ShopEntitlementOrmEntity>,
    @InjectRepository(FeatureOrmEntity)
    private readonly featureRepo: Repository<FeatureOrmEntity>,
  ) {}

  // Resolve FeatureCode (business code, vd "ADVANCED_REPORTS") -> uuid kỹ
  // thuật của FeatureOrmEntity, tự tạo Feature nếu chưa từng được cấp trước đó.
  private async resolveFeatureByCode(code: string): Promise<FeatureOrmEntity> {
    const normalizedCode = code.toUpperCase();
    const existing = await this.featureRepo.findOne({
      where: { code: normalizedCode },
    });
    if (existing) return existing;

    const created = this.featureRepo.create({
      code: normalizedCode,
      name: normalizedCode,
    });
    return this.featureRepo.save(created);
  }

  async findByMerchantAndFeature(
    merchantId: string,
    featureCode: string,
  ): Promise<ShopEntitlement | null> {
    const record = await this.ormRepo.findOne({
      where: { merchantId, feature: { code: featureCode.toUpperCase() } },
      relations: { feature: true },
    });
    return record ? EntitlementMapper.toDomain(record) : null;
  }

  async findActiveByMerchant(merchantId: string): Promise<ShopEntitlement[]> {
    const records = await this.ormRepo.find({
      where: {
        merchantId,
        isActive: true,
        expiresAt: MoreThan(new Date()),
      },
      relations: { feature: true },
    });
    return records.map(EntitlementMapper.toDomain);
  }

  async save(entitlement: ShopEntitlement): Promise<void> {
    const ormEntity = EntitlementMapper.toOrm(entitlement);
    const feature = await this.resolveFeatureByCode(
      entitlement.getFeatureCode().getValue(),
    );
    ormEntity.featureId = feature.uuid;

    // `uuid` là định danh nghiệp vụ, không phải PK — phải tra `id` (PK nội bộ)
    // của bản ghi đã tồn tại trước, nếu không TypeORM sẽ INSERT trùng thay vì UPDATE.
    const existing = await this.ormRepo.findOne({
      where: { uuid: ormEntity.uuid },
      select: { id: true },
    });
    if (existing) {
      ormEntity.id = existing.id;
    }
    await this.ormRepo.save(ormEntity);
  }
}
