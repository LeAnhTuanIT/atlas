import { IsString, IsNotEmpty } from 'class-validator';

export class ZbsTemplateParamDto {
  @IsString({ message: 'type phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'type không được để trống.' })
  type: string;

  @IsString({ message: 'name phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'name không được để trống.' })
  name: string;

  @IsString({ message: 'sample_value phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'sample_value không được để trống.' })
  sample_value: string;
}
