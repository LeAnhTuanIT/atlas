import { IsDateString } from 'class-validator';

export class TicketSessionDto {
  @IsDateString({}, { message: 'startAt phải là chuỗi ISO date hợp lệ' })
  startAt: string;

  @IsDateString({}, { message: 'endAt phải là chuỗi ISO date hợp lệ' })
  endAt: string;
}
