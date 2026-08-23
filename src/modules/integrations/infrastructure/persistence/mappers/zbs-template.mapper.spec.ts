import { ZbsTemplate } from '@/modules/integrations/domain/models/zbs-template.entity';
import { ZbsTemplateOrmEntity } from '../entities/zbs-template.orm-entity';
import { ZbsTemplateMapper } from './zbs-template.mapper';

describe('ZbsTemplateMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu — draft chưa publish (templateId null)', () => {
    const layout = { body: { components: [{ TITLE: { value: 'Xác nhận đơn hàng' } }] } };
    const params = [{ type: '1', name: 'name', sample_value: 'A' }];
    const domain = ZbsTemplate.createDraft({
      connectionId: 'conn-1',
      templateName: 'Xác nhận đơn hàng',
      templateType: '1',
      tag: '1',
      layout,
      params,
      note: 'ghi chú',
      trackingId: 'abc123',
    });

    const orm = ZbsTemplateMapper.toOrm(domain);
    orm.id = '5';
    expect(orm.uuid).toBe(domain.getUuid());
    expect(orm.connectionId).toBe('conn-1');
    expect(orm.templateId).toBeNull();
    expect(orm.layout).toEqual(layout);
    expect(orm.params).toEqual(params);

    const roundTripped = ZbsTemplateMapper.toDomain(orm);
    expect(roundTripped.getTemplateId()).toBeUndefined();
    expect(roundTripped.getTemplateName()).toBe('Xác nhận đơn hàng');
    expect(roundTripped.getTemplateType()).toBe('1');
    expect(roundTripped.getTag()).toBe('1');
    expect(roundTripped.getLayout()).toEqual(layout);
    expect(roundTripped.getParams()).toEqual(params);
    expect(roundTripped.getNote()).toBe('ghi chú');
    expect(roundTripped.getTrackingId()).toBe('abc123');
    expect(roundTripped.getStatus()).toBe('DRAFT');
  });

  it('toOrm() rồi toDomain() giữ nguyên dữ liệu — template đã publish (templateId có giá trị)', () => {
    const syncedAt = new Date('2026-08-24T10:00:00Z');
    const domain = ZbsTemplate.fromSync({
      connectionId: 'conn-1',
      templateId: 'zns-tpl-1',
      templateName: 'Xác nhận đơn hàng',
      status: 'ENABLE',
      syncedAt,
    });

    const orm = ZbsTemplateMapper.toOrm(domain);
    orm.id = '6';
    expect(orm.templateId).toBe('zns-tpl-1');

    const roundTripped = ZbsTemplateMapper.toDomain(orm);
    expect(roundTripped.getTemplateId()).toBe('zns-tpl-1');
    expect(roundTripped.getStatus()).toBe('ENABLE');
    expect(roundTripped.getSyncedAt()).toEqual(syncedAt);
  });

  it('toDomain() map reason từ orm khi có', () => {
    const orm = new ZbsTemplateOrmEntity();
    orm.id = '7';
    orm.uuid = 'uuid-7';
    orm.connectionId = 'conn-1';
    orm.templateId = 'zns-tpl-7';
    orm.templateName = 'Tên';
    orm.templateType = '1';
    orm.tag = '1';
    orm.layout = {};
    orm.params = [];
    orm.note = null;
    orm.trackingId = null;
    orm.status = 'REJECT';
    orm.reason = 'Logo không hợp lệ';
    orm.syncedAt = new Date();

    const domain = ZbsTemplateMapper.toDomain(orm);
    expect(domain.getReason()).toBe('Logo không hợp lệ');
    expect(domain.getNote()).toBeUndefined();
  });
});
