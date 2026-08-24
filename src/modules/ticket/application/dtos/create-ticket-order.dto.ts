import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentGatewayEnum } from '@/modules/payment/domain/value-objects/payment-status.vo';

export class TicketOrderLineDto {
  @IsUUID()
  ticketProductId: string;

  @IsUUID()
  ticketSessionId: string;

  @IsUUID()
  zoneId: string;

  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'quantity phải lớn hơn 0' })
  quantity: number;
}

export class CreateTicketOrderDto {
  @IsArray({ message: 'lines phải là mảng' })
  @ArrayMinSize(1, { message: 'lines phải có ít nhất 1 phần tử' })
  @ValidateNested({ each: true })
  @Type(() => TicketOrderLineDto)
  lines: TicketOrderLineDto[];

  @IsOptional()
  @IsEnum(PaymentGatewayEnum, { message: 'gateway không hợp lệ' })
  gateway?: PaymentGatewayEnum;

  @IsOptional()
  @IsString()
  returnUrl?: string;
}
