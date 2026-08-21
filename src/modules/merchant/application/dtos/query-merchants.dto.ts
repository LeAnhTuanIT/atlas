// src/modules/merchant/application/dtos/query-merchants.dto.ts
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMerchantsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Trang (page) phải là số nguyên.' })
  @Min(1, { message: 'Trang (page) tối thiểu là 1.' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lượng (limit) phải là số nguyên.' })
  @Min(1, { message: 'Số lượng tối thiểu là 1.' })
  @Max(100, { message: 'Số lượng tối đa mỗi trang là 100.' })
  limit?: number = 10;
}
