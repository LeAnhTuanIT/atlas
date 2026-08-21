import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerStatus } from '../../domain/models/customer.model';

export class GetCustomersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;

  @IsOptional()
  @IsString()
  search?: string; // Search theo tên, sđt, email

  @IsOptional()
  @IsEnum(CustomerStatus)
  status?: CustomerStatus;
}
