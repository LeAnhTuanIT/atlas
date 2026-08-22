// infrastructure/mappers/entitlement.mapper.ts
import { ShopEntitlement } from '../../domain/models/shop-entitlement.entity';
import { FeatureCode } from '../../domain/value-objects/feature-code.vo';
import { EntitlementPeriod } from '../../domain/value-objects/entitlement-period.vo';
import { ShopEntitlementOrmEntity } from '../persistence/typeorm/entities/shop-entitlement.orm-entity';

export class EntitlementMapper {
  static toDomain(orm: ShopEntitlementOrmEntity): ShopEntitlement {
    return new ShopEntitlement(
      orm.id,
      orm.shopId,
      new FeatureCode(orm.featureId),
      new EntitlementPeriod(orm.startAt, orm.expiresAt),
      orm.isActive,
    );
  }

  static toOrm(domain: ShopEntitlement): ShopEntitlementOrmEntity {
    const orm = new ShopEntitlementOrmEntity();
    orm.id = domain.getId();
    orm.shopId = domain.getShopId();
    orm.featureId = domain.getFeatureCode().getValue();
    orm.startAt = domain.getPeriod().startAt;
    orm.expiresAt = domain.getPeriod().expiresAt;
    orm.isActive = domain.getIsActive();
    return orm;
  }
}
