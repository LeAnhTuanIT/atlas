import { IsString, IsNotEmpty } from 'class-validator';

export class RevokeFeatureDto {
  @IsString()
  @IsNotEmpty({ message: 'Shop ID không được để trống' })
  shopId: string;

  @IsString()
  @IsNotEmpty({ message: 'Mã tính năng (featureCode) không được để trống' })
  featureCode: string;
}
