import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export function IsEmailOrPhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isEmailOrPhone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false
          };

          // Regex kiểm tra Email chuẩn cơ bản
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

          // Regex kiểm tra SĐT Việt Nam (bắt đầu bằng 0 hoặc +84, theo sau là 9 chữ số)
          const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

          return emailRegex.test(value) || phoneRegex.test(value);
        },
        defaultMessage(_args: ValidationArguments) {
          return 'Định dạng phải là email hoặc số điện thoại hợp lệ';
        },
      },
    });
  };
}

export class UnifiedLoginDto {
  @IsNotEmpty({ message: 'Số điện thoại hoặc email không được để trống' })
  @IsString()
  @IsEmailOrPhone({ message: 'Vui lòng nhập đúng định dạng Email hoặc Số điện thoại' })
  identifier: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  merchantId?: string;
}