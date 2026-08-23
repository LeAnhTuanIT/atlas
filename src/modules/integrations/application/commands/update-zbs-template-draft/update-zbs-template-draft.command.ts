import type { ZbsTemplateDraftUpdate } from '@/modules/integrations/domain/models/zbs-template.entity';

export class UpdateZbsTemplateDraftCommand {
  constructor(
    public readonly merchantId: string,
    public readonly templateUuid: string,
    public readonly update: ZbsTemplateDraftUpdate,
  ) {}
}
