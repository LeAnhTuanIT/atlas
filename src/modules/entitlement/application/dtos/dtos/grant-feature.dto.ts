import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class GrantFeatureDto {
  @IsString()
  @IsNotEmpty({ message: 'Shop ID không được để trống' })
  shopId: string;

  @IsString()
  @IsNotEmpty({ message: 'Mã tính năng (featureCode) không được để trống' })
  featureCode: string;

  @IsInt({ message: 'Thời hạn (tháng) phải là số nguyên' })
  @Min(1, { message: 'Thời hạn tối thiểu là 1 tháng' })
  @Max(120, { message: 'Thời hạn tối đa là 120 tháng' })
  durationMonths: number;
}
