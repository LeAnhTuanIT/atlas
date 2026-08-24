import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class TicketZoneDto {
  @IsString({ message: 'name phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'name không được để trống' })
  name: string;

  @IsInt({ message: 'quota phải là số nguyên' })
  @Min(1, { message: 'quota phải lớn hơn 0' })
  quota: number;
}
