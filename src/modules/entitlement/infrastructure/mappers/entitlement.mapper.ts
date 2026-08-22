// infrastructure/mappers/entitlement.mapper.ts
import { ShopEntitlement } from '../../domain/models/shop-entitlement.entity';
import { FeatureCode } from '../../domain/value-objects/feature-code.vo';
import { EntitlementPeriod } from '../../domain/value-objects/entitlement-period.vo';
import { ShopEntitlementOrmEntity } from '../persistence/typeorm/entities/shop-entitlement.orm-entity';

export class EntitlementMapper {
  // Yêu cầu `orm.feature` đã được load (relations: { feature: true }) —
  // domain chỉ biết đến FeatureCode (business code), không biết uuid kỹ thuật.
  static toDomain(orm: ShopEntitlementOrmEntity): ShopEntitlement {
    return new ShopEntitlement(
      orm.uuid,
      orm.merchantId,
      new FeatureCode(orm.feature.code),
      new EntitlementPeriod(orm.startAt, orm.expiresAt),
      orm.isActive,
    );
  }

  // Không gán `featureId` ở đây vì mapper không có quyền truy cập DB để
  // resolve FeatureCode (business code) -> uuid kỹ thuật của FeatureOrmEntity.
  // Việc resolve/tạo Feature và gán featureId thuộc về repository.
  static toOrm(domain: ShopEntitlement): ShopEntitlementOrmEntity {
    const orm = new ShopEntitlementOrmEntity();
    orm.uuid = domain.getId();
    orm.merchantId = domain.getMerchantId();
    orm.startAt = domain.getPeriod().startAt;
    orm.expiresAt = domain.getPeriod().expiresAt;
    orm.isActive = domain.getIsActive();
    return orm;
  }
}
