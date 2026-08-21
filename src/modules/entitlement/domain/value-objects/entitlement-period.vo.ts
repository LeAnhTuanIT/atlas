// domain/value-objects/entitlement-period.vo.ts
export class EntitlementPeriod {
  constructor(
    public readonly startAt: Date,
    public readonly expiresAt: Date,
  ) {
    if (expiresAt <= startAt) {
      throw new Error('Expires date must be greater than start date');
    }
  }

  isExpired(at: Date = new Date()): boolean {
    return at.getTime() > this.expiresAt.getTime();
  }

  extend(months: number): EntitlementPeriod {
    const baseDate = this.isExpired() ? new Date() : new Date(this.expiresAt);
    const newExpires = new Date(baseDate);
    newExpires.setMonth(newExpires.getMonth() + months);
    return new EntitlementPeriod(this.startAt, newExpires);
  }

  getExpiresTimestampSeconds(): number {
    return Math.floor(this.expiresAt.getTime() / 1000);
  }
}
