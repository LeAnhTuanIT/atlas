import {
  IsString,
  IsNotEmpty,
  IsObject,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ZbsTemplateParamDto } from './zbs-template-param.dto';

export class CreateZbsTemplateDto {
  @IsString({ message: 'Tên template phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Tên template không được để trống.' })
  templateName: string;

  @IsString({ message: 'templateType phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'templateType không được để trống.' })
  templateType: string;

  @IsString({ message: 'tag phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'tag không được để trống.' })
  tag: string;

  // Passthrough nguyên schema Zalo (header/body/footer) — không validate chi
  // tiết từng component, xem ghi chú trong domain entity ZbsTemplate.
  @IsObject({ message: 'layout phải là object.' })
  layout: Record<string, any>;

  @IsArray({ message: 'params phải là mảng.' })
  @ValidateNested({ each: true })
  @Type(() => ZbsTemplateParamDto)
  params: ZbsTemplateParamDto[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  trackingId?: string;
}
