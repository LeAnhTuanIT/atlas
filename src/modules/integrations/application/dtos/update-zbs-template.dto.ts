import {
  IsString,
  IsObject,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ZbsTemplateParamDto } from './zbs-template-param.dto';

export class UpdateZbsTemplateDto {
  @IsOptional()
  @IsString({ message: 'Tên template phải là chuỗi ký tự.' })
  templateName?: string;

  @IsOptional()
  @IsString({ message: 'templateType phải là chuỗi ký tự.' })
  templateType?: string;

  @IsOptional()
  @IsString({ message: 'tag phải là chuỗi ký tự.' })
  tag?: string;

  @IsOptional()
  @IsObject({ message: 'layout phải là object.' })
  layout?: Record<string, any>;

  @IsOptional()
  @IsArray({ message: 'params phải là mảng.' })
  @ValidateNested({ each: true })
  @Type(() => ZbsTemplateParamDto)
  params?: ZbsTemplateParamDto[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  trackingId?: string;
}
