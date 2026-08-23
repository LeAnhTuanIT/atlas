import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';
import { ZbsTemplateMapper } from './zbs-template.mapper';

describe('ZbsTemplateMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu', () => {
    const syncedAt = new Date('2026-08-24T10:00:00Z');
    const domain = ZbsTemplate.create({
      connectionId: 'conn-1',
      templateId: 'zns-tpl-1',
      templateName: 'Xác nhận đơn hàng',
      status: 'ENABLE',
      syncedAt,
    });

    const orm = ZbsTemplateMapper.toOrm(domain);
    orm.id = '5';
    expect(orm.uuid).toBe(domain.getUuid());
    expect(orm.connectionId).toBe('conn-1');
    expect(orm.templateId).toBe('zns-tpl-1');

    const roundTripped = ZbsTemplateMapper.toDomain(orm);
    expect(roundTripped.getConnectionId()).toBe('conn-1');
    expect(roundTripped.getTemplateId()).toBe('zns-tpl-1');
    expect(roundTripped.getTemplateName()).toBe('Xác nhận đơn hàng');
    expect(roundTripped.getStatus()).toBe('ENABLE');
    expect(roundTripped.getSyncedAt()).toEqual(syncedAt);
  });
});
