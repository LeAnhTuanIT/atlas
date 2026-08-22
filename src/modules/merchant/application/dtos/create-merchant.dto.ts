// src/modules/merchant/application/dtos/create-merchant.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  Matches,
  MinLength,
  MaxLength,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMerchantDto {
  @IsString({ message: 'Mã Merchant phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Mã Merchant không được để trống.' })
  @MinLength(3, { message: 'Mã Merchant phải có ít nhất 3 ký tự.' })
  @MaxLength(30, { message: 'Mã Merchant không được vượt quá 30 ký tự.' })
  @Matches(/^[a-z0-9_-]+$/, {
    message:
      'Mã Merchant chỉ gồm chữ thường, số, dấu gạch ngang (-) và gạch dưới (_).',
  })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  code: string;

  @IsString({ message: 'Tên Merchant phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Tên Merchant không được để trống.' })
  @MinLength(2, { message: 'Tên Merchant phải có ít nhất 2 ký tự.' })
  @MaxLength(100, { message: 'Tên Merchant không được vượt quá 100 ký tự.' })
  @Transform(({ value }: { value: string }) => value?.trim())
  name: string;

  // Hỗ trợ cả email hoặc adminEmail
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ.' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Admin email không hợp lệ.' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  adminEmail?: string;

  // Hỗ trợ cả password hoặc adminPassword
  @IsOptional()
  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' })
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự.' })
  password?: string;

  @IsOptional()
  @IsString({ message: 'Admin password phải là chuỗi ký tự.' })
  @MinLength(6, { message: 'Admin password tối thiểu 6 ký tự.' })
  adminPassword?: string;

  // Hỗ trợ cả fullName hoặc adminFullName
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  fullName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  adminFullName?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  phone?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  adminPhone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsObject({ message: 'Settings phải là một object.' })
  settings?: Record<string, any>;
}
