import { BaseEntity } from '@/shared/domain/base.entity';

export const ZBS_TEMPLATE_DRAFT_STATUS = 'DRAFT';

// Layout/params passthrough nguyên schema của Zalo (header/body/footer với các
// component IMAGES/LOGO/TITLE/PARAGRAPH/OTP/TABLE/VOUCHER/PAYMENT/BUTTONS...).
// Không model chi tiết từng component vì Zalo có thể có thêm component ngoài
// các ví dụ đã biết — hệ thống chỉ lưu & forward nguyên object khi publish.
export type ZbsTemplateLayout = Record<string, any>;

export interface ZbsTemplateParam {
  type: string;
  name: string;
  sample_value: string;
}

export interface CreateZbsTemplateDraftParams {
  connectionId: string;
  templateName: string;
  templateType: string;
  tag: string;
  layout: ZbsTemplateLayout;
  params: ZbsTemplateParam[];
  note?: string;
  trackingId?: string;
}

export interface ZbsTemplateDraftUpdate {
  templateName?: string;
  templateType?: string;
  tag?: string;
  layout?: ZbsTemplateLayout;
  params?: ZbsTemplateParam[];
  note?: string;
  trackingId?: string;
}

export interface FromSyncParams {
  connectionId: string;
  templateId: string;
  templateName: string;
  status: string;
  syncedAt: Date;
}

export interface ZbsTemplateSyncUpdate {
  templateName: string;
  status: string;
  syncedAt: Date;
}

export interface ZbsTemplatePublishResult {
  templateId: string;
  status: string;
}

export class ZbsTemplate extends BaseEntity<string> {
  constructor(
    uuid: string,
    private readonly connectionId: string,
    private templateId: string | undefined,
    private templateName: string,
    private templateType: string,
    private tag: string,
    private layout: ZbsTemplateLayout,
    private params: ZbsTemplateParam[],
    private note: string | undefined,
    private trackingId: string | undefined,
    private status: string,
    private reason: string | undefined,
    private syncedAt: Date | undefined,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(uuid, createdAt, updatedAt);
  }

  /** Tạo draft cục bộ — chưa publish lên Zalo (chưa có templateId). */
  static createDraft(params: CreateZbsTemplateDraftParams): ZbsTemplate {
    return new ZbsTemplate(
      crypto.randomUUID(),
      params.connectionId,
      undefined,
      params.templateName,
      params.templateType,
      params.tag,
      params.layout,
      params.params,
      params.note,
      params.trackingId,
      ZBS_TEMPLATE_DRAFT_STATUS,
      undefined,
      undefined,
    );
  }

  /** Tạo từ dữ liệu API list/sync của Zalo (chỉ có templateId/templateName/status). */
  static fromSync(params: FromSyncParams): ZbsTemplate {
    return new ZbsTemplate(
      crypto.randomUUID(),
      params.connectionId,
      params.templateId,
      params.templateName,
      '',
      '',
      {},
      [],
      undefined,
      undefined,
      params.status,
      undefined,
      params.syncedAt,
    );
  }

  updateFromSync(update: ZbsTemplateSyncUpdate): void {
    this.templateName = update.templateName;
    this.status = update.status;
    this.syncedAt = update.syncedAt;
    this._updatedAt = new Date();
  }

  updateDraft(update: ZbsTemplateDraftUpdate): void {
    if (update.templateName !== undefined)
      this.templateName = update.templateName;
    if (update.templateType !== undefined)
      this.templateType = update.templateType;
    if (update.tag !== undefined) this.tag = update.tag;
    if (update.layout !== undefined) this.layout = update.layout;
    if (update.params !== undefined) this.params = update.params;
    if (update.note !== undefined) this.note = update.note;
    if (update.trackingId !== undefined) this.trackingId = update.trackingId;
    this._updatedAt = new Date();
  }

  markPublished(result: ZbsTemplatePublishResult): void {
    this.templateId = result.templateId;
    this.status = result.status;
    this.syncedAt = new Date();
    this._updatedAt = new Date();
  }

  updateStatusFromWebhook(status: string, reason?: string): void {
    this.status = status;
    this.reason = reason;
    this._updatedAt = new Date();
  }

  getUuid(): string {
    return this.id;
  }
  getConnectionId(): string {
    return this.connectionId;
  }
  getTemplateId(): string | undefined {
    return this.templateId;
  }
  getTemplateName(): string {
    return this.templateName;
  }
  getTemplateType(): string {
    return this.templateType;
  }
  getTag(): string {
    return this.tag;
  }
  getLayout(): ZbsTemplateLayout {
    return this.layout;
  }
  getParams(): ZbsTemplateParam[] {
    return this.params;
  }
  getNote(): string | undefined {
    return this.note;
  }
  getTrackingId(): string | undefined {
    return this.trackingId;
  }
  getStatus(): string {
    return this.status;
  }
  getReason(): string | undefined {
    return this.reason;
  }
  getSyncedAt(): Date | undefined {
    return this.syncedAt;
  }
}
