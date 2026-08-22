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

  private getKey(merchantId: string): string {
    return `entitlements:merchant:${merchantId}`;
  }

  async getFeatureExpiration(
    merchantId: string,
    featureCode: string,
  ): Promise<number | null> {
    const score = await this.redis.zscore(
      this.getKey(merchantId),
      featureCode.toUpperCase(),
    );
    return score !== null ? Number(score) : null;
  }

  async setMerchantActiveFeatures(
    merchantId: string,
    entitlements: ShopEntitlement[],
  ): Promise<void> {
    const key = this.getKey(merchantId);
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

  async invalidateMerchant(merchantId: string): Promise<void> {
    await this.redis.del(this.getKey(merchantId));
  }
}
