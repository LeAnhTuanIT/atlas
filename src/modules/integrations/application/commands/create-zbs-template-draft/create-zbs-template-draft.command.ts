import type {
  ZbsTemplateLayout,
  ZbsTemplateParam,
} from '@/modules/integrations/domain/models/zbs-template.entity';

export class CreateZbsTemplateDraftCommand {
  constructor(
    public readonly merchantId: string,
    public readonly templateName: string,
    public readonly templateType: string,
    public readonly tag: string,
    public readonly layout: ZbsTemplateLayout,
    public readonly params: ZbsTemplateParam[],
    public readonly note?: string,
    public readonly trackingId?: string,
  ) {}
}
