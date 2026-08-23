import { BaseEntity } from '@/shared/domain/base.entity';

export interface CreateZbsTemplateParams {
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

export class ZbsTemplate extends BaseEntity<string> {
  constructor(
    uuid: string,
    private readonly connectionId: string,
    private readonly templateId: string,
    private templateName: string,
    private status: string,
    private syncedAt: Date,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(uuid, createdAt, updatedAt);
  }

  static create(params: CreateZbsTemplateParams): ZbsTemplate {
    return new ZbsTemplate(
      crypto.randomUUID(),
      params.connectionId,
      params.templateId,
      params.templateName,
      params.status,
      params.syncedAt,
    );
  }

  updateFromSync(update: ZbsTemplateSyncUpdate): void {
    this.templateName = update.templateName;
    this.status = update.status;
    this.syncedAt = update.syncedAt;
    this._updatedAt = new Date();
  }

  getUuid(): string {
    return this.id;
  }
  getConnectionId(): string {
    return this.connectionId;
  }
  getTemplateId(): string {
    return this.templateId;
  }
  getTemplateName(): string {
    return this.templateName;
  }
  getStatus(): string {
    return this.status;
  }
  getSyncedAt(): Date {
    return this.syncedAt;
  }
}
