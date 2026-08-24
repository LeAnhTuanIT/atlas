import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import { TicketZone } from '@/modules/ticket/domain/models/ticket-zone.entity';
import { TicketSession } from '@/modules/ticket/domain/models/ticket-session.entity';
import {
  TicketProductStatusEnum,
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketProductOrmEntity } from '../typeorm/entities/ticket-product.orm-entity';
import { TicketZoneOrmEntity } from '../typeorm/entities/ticket-zone.orm-entity';
import { TicketSessionOrmEntity } from '../typeorm/entities/ticket-session.orm-entity';

export class TicketProductMapper {
  static toDomain(orm: TicketProductOrmEntity): TicketProduct {
    return new TicketProduct(
      orm.uuid,
      orm.merchantId,
      orm.name,
      orm.description ?? undefined,
      orm.priceAmount,
      orm.priceCurrency,
      orm.validityType as TicketValidityTypeEnum,
      {
        type: orm.usageType as TicketUsageTypeEnum,
        maxUses: orm.usageMaxUses ?? undefined,
      },
      (orm.zones ?? []).map(
        (z) => new TicketZone({ id: z.uuid, name: z.name, quota: z.quota }),
      ),
      (orm.sessions ?? []).map(
        (s) => new TicketSession({ id: s.uuid, startAt: s.startAt, endAt: s.endAt }),
      ),
      orm.status as TicketProductStatusEnum,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: TicketProduct): TicketProductOrmEntity {
    const orm = new TicketProductOrmEntity();
    orm.uuid = domain.id;
    orm.merchantId = domain.getMerchantId();
    orm.name = domain.getName();
    orm.description = domain.getDescription() ?? null;
    orm.priceAmount = domain.getPriceAmount();
    orm.priceCurrency = domain.getPriceCurrency();
    orm.validityType = domain.getValidityType();
    orm.usageType = domain.getUsageRule().type;
    orm.usageMaxUses = domain.getUsageRule().maxUses ?? null;
    orm.status = domain.getStatus();
    orm.zones = domain.getZones().map((z) => {
      const zoneOrm = new TicketZoneOrmEntity();
      zoneOrm.uuid = z.getId();
      zoneOrm.name = z.getName();
      zoneOrm.quota = z.getQuota();
      return zoneOrm;
    });
    orm.sessions = domain.getSessions().map((s) => {
      const sessionOrm = new TicketSessionOrmEntity();
      sessionOrm.uuid = s.getId();
      sessionOrm.startAt = s.getStartAt();
      sessionOrm.endAt = s.getEndAt();
      return sessionOrm;
    });
    return orm;
  }
}
