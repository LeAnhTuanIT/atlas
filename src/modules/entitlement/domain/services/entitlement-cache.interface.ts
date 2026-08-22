// domain/services/entitlement-cache.interface.ts
import { ShopEntitlement } from '../models/shop-entitlement.entity';

export interface IEntitlementCacheService {
  getFeatureExpiration(
    shopId: string,
    featureCode: string,
  ): Promise<number | null>;
  setShopActiveFeatures(
    shopId: string,
    entitlements: ShopEntitlement[],
  ): Promise<void>;
  invalidateShop(shopId: string): Promise<void>;
}
export const ENTITLEMENT_CACHE_SERVICE = Symbol('IEntitlementCacheService');
