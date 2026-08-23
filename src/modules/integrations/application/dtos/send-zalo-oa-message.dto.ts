import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SendZaloOaMessageDto {
  @IsString({ message: 'Người nhận phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Người nhận không được để trống.' })
  to: string;

  @IsString({ message: 'Nội dung phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Nội dung không được để trống.' })
  @MaxLength(2000, { message: 'Nội dung không được vượt quá 2000 ký tự.' })
  content: string;

  @IsOptional()
  @IsString()
  type?: string;
}
