import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ZaloMiniAppLoginDto {
  @IsNotEmpty({ message: 'zaloMiniAppId không được để trống' })
  @IsString()
  zaloMiniAppId: string;

  @IsNotEmpty({ message: 'uid không được để trống' })
  @IsString()
  uid: string;

  @IsNotEmpty({ message: 'accessToken không được để trống' })
  @IsString()
  accessToken: string;

  // Chỉ bắt buộc khi customer chưa từng đăng nhập Zalo lần nào (chưa có
  // zaloUid liên kết) — lần đăng nhập sau không cần xin lại quyền SĐT.
  @IsOptional()
  @IsString()
  phoneToken?: string;
}
