import { ZbsTemplate } from './zbs-template.entity';

describe('ZbsTemplate', () => {
  it('create() khởi tạo đầy đủ field và sinh uuid', () => {
    const syncedAt = new Date('2026-08-24T10:00:00Z');
    const template = ZbsTemplate.create({
      connectionId: 'conn-1',
      templateId: 'zns-tpl-1',
      templateName: 'Xác nhận đơn hàng',
      status: 'ENABLE',
      syncedAt,
    });

    expect(template.getConnectionId()).toBe('conn-1');
    expect(template.getTemplateId()).toBe('zns-tpl-1');
    expect(template.getTemplateName()).toBe('Xác nhận đơn hàng');
    expect(template.getStatus()).toBe('ENABLE');
    expect(template.getSyncedAt()).toEqual(syncedAt);
    expect(template.getUuid()).toEqual(expect.any(String));
  });

  it('updateFromSync() cập nhật tên/trạng thái/thời điểm đồng bộ mới nhất', () => {
    const template = ZbsTemplate.create({
      connectionId: 'conn-1',
      templateId: 'zns-tpl-1',
      templateName: 'Tên cũ',
      status: 'PENDING_REVIEW',
      syncedAt: new Date('2026-08-24T10:00:00Z'),
    });

    const newSyncedAt = new Date('2026-08-24T12:00:00Z');
    template.updateFromSync({
      templateName: 'Tên mới',
      status: 'ENABLE',
      syncedAt: newSyncedAt,
    });

    expect(template.getTemplateName()).toBe('Tên mới');
    expect(template.getStatus()).toBe('ENABLE');
    expect(template.getSyncedAt()).toEqual(newSyncedAt);
  });
});
