// domain/repositories/entitlement.repository.interface.ts
import { ShopEntitlement } from '../models/shop-entitlement.entity';

export interface IEntitlementRepository {
  findByMerchantAndFeature(
    merchantId: string,
    featureCode: string,
  ): Promise<ShopEntitlement | null>;
  findActiveByMerchant(merchantId: string): Promise<ShopEntitlement[]>;
  save(entitlement: ShopEntitlement): Promise<void>;
}
export const ENTITLEMENT_REPOSITORY = Symbol('IEntitlementRepository');
