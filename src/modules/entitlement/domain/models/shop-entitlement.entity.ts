// domain/models/shop-entitlement.entity.ts
import { FeatureCode } from '../value-objects/feature-code.vo';
import { EntitlementPeriod } from '../value-objects/entitlement-period.vo';

export class ShopEntitlement {
  constructor(
    private readonly id: string,
    private readonly shopId: string,
    private readonly featureCode: FeatureCode,
    private period: EntitlementPeriod,
    private isActive: boolean,
  ) {}

  static create(id: string, shopId: string, featureCode: string, durationMonths: number): ShopEntitlement {
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

    return new ShopEntitlement(
      id,
      shopId,
      new FeatureCode(featureCode),
      new EntitlementPeriod(now, expiresAt),
      true,
    );
  }

  extendDuration(months: number): void {
    this.period = this.period.extend(months);
    this.isActive = true;
  }

  revoke(): void {
    this.isActive = false;
  }

  canAccess(at: Date = new Date()): boolean {
    return this.isActive && !this.period.isExpired(at);
  }

  // Getters for State Mapping
  getId(): string { return this.id; }
  getShopId(): string { return this.shopId; }
  getFeatureCode(): FeatureCode { return this.featureCode; }
  getPeriod(): EntitlementPeriod { return this.period; }
  getIsActive(): boolean { return this.isActive; }
}