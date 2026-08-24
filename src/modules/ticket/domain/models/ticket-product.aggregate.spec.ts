import { TicketProduct } from './ticket-product.aggregate';
import {
  TicketProductStatusEnum,
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '../value-objects/ticket-enums.vo';

function buildValidParams(overrides: Partial<Parameters<typeof TicketProduct.create>[0]> = {}) {
  return {
    merchantId: 'merchant-1',
    name: 'Vé khu vui chơi',
    description: 'Vé vào cổng khu vui chơi',
    priceAmount: 100000,
    priceCurrency: 'VND',
    validityType: TicketValidityTypeEnum.DAY_PASS,
    usageRule: { type: TicketUsageTypeEnum.UNLIMITED_USE },
    zones: [{ name: 'DEFAULT', quota: 100 }],
    sessions: [
      { startAt: new Date('2026-09-01T00:00:00Z'), endAt: new Date('2026-09-01T23:59:59Z') },
    ],
    ...overrides,
  };
}

describe('TicketProduct', () => {
  it('tạo mới ở trạng thái DRAFT với zone/session hợp lệ', () => {
    const product = TicketProduct.create(buildValidParams());

    expect(product.getStatus()).toBe(TicketProductStatusEnum.DRAFT);
    expect(product.getZones()).toHaveLength(1);
    expect(product.getZones()[0].getQuota()).toBe(100);
    expect(product.getSessions()).toHaveLength(1);
    expect(product.isPublished()).toBe(false);
  });

  it('ném lỗi khi không có zone nào', () => {
    expect(() => TicketProduct.create(buildValidParams({ zones: [] }))).toThrow(
      'Loại vé phải có ít nhất 1 zone',
    );
  });

  it('ném lỗi khi quota zone <= 0', () => {
    expect(() =>
      TicketProduct.create(buildValidParams({ zones: [{ name: 'VIP', quota: 0 }] })),
    ).toThrow('Quota của zone phải lớn hơn 0');
  });

  it('ném lỗi khi không có session nào', () => {
    expect(() => TicketProduct.create(buildValidParams({ sessions: [] }))).toThrow(
      'Loại vé phải có ít nhất 1 session hiệu lực',
    );
  });

  it('ném lỗi khi giá vé âm', () => {
    expect(() => TicketProduct.create(buildValidParams({ priceAmount: -1 }))).toThrow(
      'Giá vé không được âm',
    );
  });

  it('ném lỗi khi LIMITED_USE không có maxUses hợp lệ', () => {
    expect(() =>
      TicketProduct.create(
        buildValidParams({ usageRule: { type: TicketUsageTypeEnum.LIMITED_USE } }),
      ),
    ).toThrow('LIMITED_USE phải có maxUses > 0');
  });

  it('publish() chuyển DRAFT -> PUBLISHED', () => {
    const product = TicketProduct.create(buildValidParams());
    product.publish();
    expect(product.getStatus()).toBe(TicketProductStatusEnum.PUBLISHED);
    expect(product.isPublished()).toBe(true);
  });

  it('publish() ném lỗi khi không ở trạng thái DRAFT', () => {
    const product = TicketProduct.create(buildValidParams());
    product.publish();
    expect(() => product.publish()).toThrow(
      'Không thể publish loại vé đang ở trạng thái PUBLISHED',
    );
  });

  it('findZone()/findSession() trả về đúng entity theo id, undefined nếu không có', () => {
    const product = TicketProduct.create(buildValidParams());
    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    expect(product.findZone(zoneId)?.getId()).toBe(zoneId);
    expect(product.findSession(sessionId)?.getId()).toBe(sessionId);
    expect(product.findZone('khong-ton-tai')).toBeUndefined();
  });
});
