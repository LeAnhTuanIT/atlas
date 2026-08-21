// entitlement.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShopEntitlementOrmEntity } from './infrastructure/persistence/typeorm/entities/shop-entitlement.orm-entity';
import { ENTITLEMENT_REPOSITORY } from './domain/repositories/entitlement.repository.interface';
import { ENTITLEMENT_CACHE_SERVICE } from './domain/services/entitlement-cache.interface';
import { EntitlementTypeormRepository } from './infrastructure/persistence/typeorm/entitlement.typeorm.repository';
import { RedisEntitlementCacheService } from './infrastructure/cache/redis-entitlement-cache.service';
import { CheckFeatureAccessHandler } from './application/queries/check-feature-access.handler';
import { GrantFeatureHandler } from './application/commands/grant-feature.handler';
import { FeatureGuard } from './presentation/guards/feature.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ShopEntitlementOrmEntity])],
  providers: [
    CheckFeatureAccessHandler,
    GrantFeatureHandler,
    FeatureGuard,
    {
      provide: ENTITLEMENT_REPOSITORY,
      useClass: EntitlementTypeormRepository,
    },
    {
      provide: ENTITLEMENT_CACHE_SERVICE,
      useClass: RedisEntitlementCacheService,
    },
  ],
  exports: [CheckFeatureAccessHandler, GrantFeatureHandler, FeatureGuard],
})
export class EntitlementModule {}