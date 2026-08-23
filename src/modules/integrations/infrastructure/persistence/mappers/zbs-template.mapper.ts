import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';
import { ZbsTemplateOrmEntity } from '../entities/zbs-template.orm-entity';

export class ZbsTemplateMapper {
  static toDomain(orm: ZbsTemplateOrmEntity): ZbsTemplate {
    return new ZbsTemplate(
      orm.uuid,
      orm.connectionId,
      orm.templateId ?? undefined,
      orm.templateName,
      orm.templateType,
      orm.tag,
      orm.layout,
      orm.params,
      orm.note ?? undefined,
      orm.trackingId ?? undefined,
      orm.status,
      orm.reason ?? undefined,
      orm.syncedAt ?? undefined,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: ZbsTemplate): ZbsTemplateOrmEntity {
    const orm = new ZbsTemplateOrmEntity();
    orm.uuid = domain.getUuid();
    orm.connectionId = domain.getConnectionId();
    orm.templateId = domain.getTemplateId() ?? null;
    orm.templateName = domain.getTemplateName();
    orm.templateType = domain.getTemplateType();
    orm.tag = domain.getTag();
    orm.layout = domain.getLayout();
    orm.params = domain.getParams();
    orm.note = domain.getNote() ?? null;
    orm.trackingId = domain.getTrackingId() ?? null;
    orm.status = domain.getStatus();
    orm.reason = domain.getReason() ?? null;
    orm.syncedAt = domain.getSyncedAt() ?? null;
    return orm;
  }
}
