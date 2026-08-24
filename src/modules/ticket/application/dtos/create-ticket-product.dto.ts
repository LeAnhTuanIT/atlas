import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketValidityTypeEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketUsageRuleDto } from './ticket-usage-rule.dto';
import { TicketZoneDto } from './ticket-zone.dto';
import { TicketSessionDto } from './ticket-session.dto';

export class CreateTicketProductDto {
  @IsString({ message: 'name phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'name không được để trống' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt({ message: 'priceAmount phải là số nguyên' })
  @Min(0, { message: 'priceAmount không được âm' })
  priceAmount: number;

  @IsOptional()
  @IsString()
  priceCurrency?: string;

  @IsString({ message: 'validityType không hợp lệ' })
  validityType: TicketValidityTypeEnum;

  @ValidateNested()
  @Type(() => TicketUsageRuleDto)
  usageRule: TicketUsageRuleDto;

  @IsArray({ message: 'zones phải là mảng' })
  @ArrayMinSize(1, { message: 'zones phải có ít nhất 1 phần tử' })
  @ValidateNested({ each: true })
  @Type(() => TicketZoneDto)
  zones: TicketZoneDto[];

  @IsArray({ message: 'sessions phải là mảng' })
  @ArrayMinSize(1, { message: 'sessions phải có ít nhất 1 phần tử' })
  @ValidateNested({ each: true })
  @Type(() => TicketSessionDto)
  sessions: TicketSessionDto[];
}
