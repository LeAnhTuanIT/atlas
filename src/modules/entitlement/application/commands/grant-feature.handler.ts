// src/modules/entitlement/application/commands/grant-feature.handler.ts
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ShopEntitlement } from '../../domain/models/shop-entitlement.entity';
import { ENTITLEMENT_REPOSITORY } from '../../domain/repositories/entitlement.repository.interface';
import type { IEntitlementRepository } from '../../domain/repositories/entitlement.repository.interface';
import { ENTITLEMENT_CACHE_SERVICE } from '../../domain/services/entitlement-cache.interface';
import type { IEntitlementCacheService } from '../../domain/services/entitlement-cache.interface';
import { GrantFeatureCommand } from './grant-feature.command';

@Injectable()
export class GrantFeatureHandler {
  constructor(
    @Inject(ENTITLEMENT_REPOSITORY)
    private readonly entitlementRepo: IEntitlementRepository,
    @Inject(ENTITLEMENT_CACHE_SERVICE)
    private readonly cacheService: IEntitlementCacheService,
  ) {}

  async execute(cmd: GrantFeatureCommand): Promise<void> {
    let entitlement = await this.entitlementRepo.findByMerchantAndFeature(
      cmd.merchantId,
      cmd.featureCode,
    );

    if (entitlement) {
      entitlement.extendDuration(cmd.durationMonths);
    } else {
      entitlement = ShopEntitlement.create(
        randomUUID(),
        cmd.merchantId,
        cmd.featureCode,
        cmd.durationMonths,
      );
    }

    await this.entitlementRepo.save(entitlement);

    const activeList = await this.entitlementRepo.findActiveByMerchant(
      cmd.merchantId,
    );
    await this.cacheService.setMerchantActiveFeatures(
      cmd.merchantId,
      activeList,
    );
  }
}
