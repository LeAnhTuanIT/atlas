import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListZaloOaMessagesDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit phải là số nguyên.' })
  @Min(1, { message: 'Limit tối thiểu là 1.' })
  @Max(100, { message: 'Limit tối đa là 100.' })
  limit?: number;
}
