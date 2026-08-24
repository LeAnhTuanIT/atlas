import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TicketUsageTypeEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

export class TicketUsageRuleDto {
  @IsEnum(TicketUsageTypeEnum, { message: 'usageRule.type không hợp lệ' })
  type: TicketUsageTypeEnum;

  @IsOptional()
  @IsInt({ message: 'maxUses phải là số nguyên' })
  @Min(1, { message: 'maxUses phải lớn hơn 0' })
  maxUses?: number;
}
