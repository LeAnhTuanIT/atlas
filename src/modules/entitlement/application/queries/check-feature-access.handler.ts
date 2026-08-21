// application/queries/check-feature-access.handler.ts
import { Inject, Injectable } from '@nestjs/common';
import  type { IEntitlementRepository } from '../../domain/repositories/entitlement.repository.interface';
import type { IEntitlementCacheService } from '../../domain/services/entitlement-cache.interface';
import { ENTITLEMENT_CACHE_SERVICE } from '../../domain/services/entitlement-cache.interface';
import { ENTITLEMENT_REPOSITORY } from '../../domain/repositories/entitlement.repository.interface';


@Injectable()
export class CheckFeatureAccessHandler {
  constructor(
    @Inject(ENTITLEMENT_CACHE_SERVICE)
    private readonly cacheService: IEntitlementCacheService,
    @Inject(ENTITLEMENT_REPOSITORY)
    private readonly entitlementRepo: IEntitlementRepository,
  ) {}

  async execute(shopId: string, featureCode: string): Promise<boolean> {
    const nowSeconds = Math.floor(Date.now() / 1000);

    // 1. Check L1: Cache (Redis)
    const cachedExpiresAt = await this.cacheService.getFeatureExpiration(shopId, featureCode);
    if (cachedExpiresAt !== null) {
      return cachedExpiresAt > nowSeconds;
    }

    // 2. Fallback L2: Database & Warm-up Cache
    const activeEntitlements = await this.entitlementRepo.findActiveByShop(shopId);
    await this.cacheService.setShopActiveFeatures(shopId, activeEntitlements);

    const target = activeEntitlements.find(e => e.getFeatureCode().getValue() === featureCode.toUpperCase());
    return target ? target.canAccess() : false;
  }
}