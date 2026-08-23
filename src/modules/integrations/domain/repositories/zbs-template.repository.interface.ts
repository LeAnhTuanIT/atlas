import type { ZbsTemplate } from '../models/zbs-template.entity';

export interface IZbsTemplateRepository {
  findByConnection(connectionId: string): Promise<ZbsTemplate[]>;
  findByConnectionAndTemplateId(
    connectionId: string,
    templateId: string,
  ): Promise<ZbsTemplate | null>;
  save(template: ZbsTemplate): Promise<void>;
}

export const ZBS_TEMPLATE_REPOSITORY = Symbol('IZbsTemplateRepository');
