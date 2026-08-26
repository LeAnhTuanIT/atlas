import { IsNotEmpty, IsString } from 'class-validator';

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

  @IsNotEmpty({ message: 'phoneToken không được để trống' })
  @IsString()
  phoneToken: string;
}
