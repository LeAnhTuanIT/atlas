export class ShopFeatureResponseDto {
  featureCode: string;
  isActive: boolean;
  startAt: Date;
  expiresAt: Date;
  daysLeft: number;

  constructor(partial: Partial<ShopFeatureResponseDto>) {
    Object.assign(this, partial);
  }
}
