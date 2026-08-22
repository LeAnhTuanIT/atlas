import { IsString, IsNotEmpty } from 'class-validator';

export class RevokeFeatureDto {
  @IsString()
  @IsNotEmpty({ message: 'Merchant ID không được để trống' })
  merchantId: string;

  @IsString()
  @IsNotEmpty({ message: 'Mã tính năng (featureCode) không được để trống' })
  featureCode: string;
}
