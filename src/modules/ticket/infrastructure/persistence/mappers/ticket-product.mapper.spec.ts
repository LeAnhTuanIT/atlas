import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import {
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketProductMapper } from './ticket-product.mapper';

describe('TicketProductMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu, bao gồm zones và sessions', () => {
    const domain = TicketProduct.create({
      merchantId: 'merchant-1',
      name: 'Vé zone concert',
      description: 'Zone VIP + Zone thường',
      priceAmount: 500000,
      priceCurrency: 'VND',
      validityType: TicketValidityTypeEnum.SESSION,
      usageRule: { type: TicketUsageTypeEnum.UNLIMITED_USE },
      zones: [
        { name: 'VIP', quota: 200 },
        { name: 'Thường', quota: 1000 },
      ],
      sessions: [
        { startAt: new Date('2026-09-01T14:00:00Z'), endAt: new Date('2026-09-01T16:00:00Z') },
      ],
    });

    const orm = TicketProductMapper.toOrm(domain);
    orm.id = '1';
    orm.zones.forEach((z, i) => (z.id = String(i + 1)));
    orm.sessions.forEach((s, i) => (s.id = String(i + 1)));

    expect(orm.uuid).toBe(domain.id);
    expect(orm.zones).toHaveLength(2);
    expect(orm.zones[0].quota).toBe(200);
    expect(orm.sessions).toHaveLength(1);

    const roundTripped = TicketProductMapper.toDomain(orm);
    expect(roundTripped.id).toBe(domain.id);
    expect(roundTripped.getName()).toBe('Vé zone concert');
    expect(roundTripped.getPriceAmount()).toBe(500000);
    expect(roundTripped.getZones().map((z) => z.getName())).toEqual(['VIP', 'Thường']);
    expect(roundTripped.getSessions()).toHaveLength(1);
    expect(roundTripped.getStatus()).toBe(domain.getStatus());
  });
});
