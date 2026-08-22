// domain/services/entitlement-cache.interface.ts
import { ShopEntitlement } from '../models/shop-entitlement.entity';

export interface IEntitlementCacheService {
  getFeatureExpiration(
    merchantId: string,
    featureCode: string,
  ): Promise<number | null>;
  setMerchantActiveFeatures(
    merchantId: string,
    entitlements: ShopEntitlement[],
  ): Promise<void>;
  invalidateMerchant(merchantId: string): Promise<void>;
}
export const ENTITLEMENT_CACHE_SERVICE = Symbol('IEntitlementCacheService');
