import { ZbsTemplate } from './zbs-template.entity';

describe('ZbsTemplate', () => {
  const layout = {
    body: { components: [{ TITLE: { value: 'Xác nhận đơn hàng' } }] },
  };
  const params = [{ type: '1', name: 'name', sample_value: 'Nguyễn Văn A' }];

  it('createDraft() khởi tạo draft cục bộ, chưa có templateId, status=DRAFT', () => {
    const template = ZbsTemplate.createDraft({
      connectionId: 'conn-1',
      templateName: 'Xác nhận đơn hàng',
      templateType: '1',
      tag: '1',
      layout,
      params,
      note: 'ghi chú',
      trackingId: 'abc123',
    });

    expect(template.getConnectionId()).toBe('conn-1');
    expect(template.getTemplateId()).toBeUndefined();
    expect(template.getTemplateName()).toBe('Xác nhận đơn hàng');
    expect(template.getTemplateType()).toBe('1');
    expect(template.getTag()).toBe('1');
    expect(template.getLayout()).toEqual(layout);
    expect(template.getParams()).toEqual(params);
    expect(template.getNote()).toBe('ghi chú');
    expect(template.getTrackingId()).toBe('abc123');
    expect(template.getStatus()).toBe('DRAFT');
    expect(template.getUuid()).toEqual(expect.any(String));
  });

  it('fromSync() khởi tạo từ dữ liệu API list (chỉ có templateId/templateName/status)', () => {
    const syncedAt = new Date('2026-08-24T10:00:00Z');
    const template = ZbsTemplate.fromSync({
      connectionId: 'conn-1',
      templateId: 'zns-tpl-1',
      templateName: 'Xác nhận đơn hàng',
      status: 'ENABLE',
      syncedAt,
    });

    expect(template.getTemplateId()).toBe('zns-tpl-1');
    expect(template.getStatus()).toBe('ENABLE');
    expect(template.getSyncedAt()).toEqual(syncedAt);
  });

  it('updateFromSync() cập nhật tên/trạng thái/thời điểm đồng bộ mới nhất', () => {
    const template = ZbsTemplate.fromSync({
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

  it('updateDraft() cập nhật một phần nội dung draft', () => {
    const template = ZbsTemplate.createDraft({
      connectionId: 'conn-1',
      templateName: 'Tên cũ',
      templateType: '1',
      tag: '1',
      layout,
      params,
    });

    template.updateDraft({ templateName: 'Tên mới', tag: '2' });

    expect(template.getTemplateName()).toBe('Tên mới');
    expect(template.getTag()).toBe('2');
    expect(template.getTemplateType()).toBe('1'); // không đổi field không truyền
    expect(template.getLayout()).toEqual(layout);
  });

  it('markPublished() gán templateId + status trả về từ Zalo, cập nhật syncedAt', () => {
    const template = ZbsTemplate.createDraft({
      connectionId: 'conn-1',
      templateName: 'Xác nhận đơn hàng',
      templateType: '1',
      tag: '1',
      layout,
      params,
    });

    template.markPublished({ templateId: 'zns-tpl-99', status: 'PENDING_REVIEW' });

    expect(template.getTemplateId()).toBe('zns-tpl-99');
    expect(template.getStatus()).toBe('PENDING_REVIEW');
    expect(template.getSyncedAt()).toEqual(expect.any(Date));
  });

  it('updateStatusFromWebhook() cập nhật status + reason khi Zalo duyệt/từ chối', () => {
    const template = ZbsTemplate.fromSync({
      connectionId: 'conn-1',
      templateId: 'zns-tpl-1',
      templateName: 'Xác nhận đơn hàng',
      status: 'PENDING_REVIEW',
      syncedAt: new Date(),
    });

    template.updateStatusFromWebhook('REJECT', 'Logo không hợp lệ');

    expect(template.getStatus()).toBe('REJECT');
    expect(template.getReason()).toBe('Logo không hợp lệ');
  });
});
