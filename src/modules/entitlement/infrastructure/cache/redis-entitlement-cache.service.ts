// src/modules/entitlement/infrastructure/cache/redis-entitlement-cache.service.ts
import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import type { IEntitlementCacheService } from '../../domain/services/entitlement-cache.interface';
import type { ShopEntitlement } from '../../domain/models/shop-entitlement.entity';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Injectable()
export class RedisEntitlementCacheService implements IEntitlementCacheService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  private getKey(shopId: string): string {
    return `entitlements:shop:${shopId}`;
  }

  async getFeatureExpiration(
    shopId: string,
    featureCode: string,
  ): Promise<number | null> {
    const score = await this.redis.zscore(
      this.getKey(shopId),
      featureCode.toUpperCase(),
    );
    return score !== null ? Number(score) : null;
  }

  async setShopActiveFeatures(
    shopId: string,
    entitlements: ShopEntitlement[],
  ): Promise<void> {
    const key = this.getKey(shopId);
    await this.redis.del(key);

    if (entitlements.length === 0) return;

    const zsetArgs: (string | number)[] = [];
    entitlements.forEach((e) => {
      zsetArgs.push(
        e.getPeriod().getExpiresTimestampSeconds(),
        e.getFeatureCode().getValue(),
      );
    });

    await this.redis.zadd(key, ...(zsetArgs as [number, string]));
    await this.redis.expire(key, 86400 * 2);
  }

  async invalidateShop(shopId: string): Promise<void> {
    await this.redis.del(this.getKey(shopId));
  }
}
