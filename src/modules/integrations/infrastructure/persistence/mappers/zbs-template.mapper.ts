import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';
import { ZbsTemplateOrmEntity } from '../entities/zbs-template.orm-entity';

export class ZbsTemplateMapper {
  static toDomain(orm: ZbsTemplateOrmEntity): ZbsTemplate {
    return new ZbsTemplate(
      orm.uuid,
      orm.connectionId,
      orm.templateId,
      orm.templateName,
      orm.status,
      orm.syncedAt,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: ZbsTemplate): ZbsTemplateOrmEntity {
    const orm = new ZbsTemplateOrmEntity();
    orm.uuid = domain.getUuid();
    orm.connectionId = domain.getConnectionId();
    orm.templateId = domain.getTemplateId();
    orm.templateName = domain.getTemplateName();
    orm.status = domain.getStatus();
    orm.syncedAt = domain.getSyncedAt();
    return orm;
  }
}
