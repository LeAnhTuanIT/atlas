import { DataSource } from 'typeorm';
import { dataSourceOptions } from '@/infrastructure/database/data-source';
import { TicketZoneOrmEntity } from './entities/ticket-zone.orm-entity';
import { TicketProductOrmEntity } from './entities/ticket-product.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';

describe('TicketZone quota — chống oversell khi trừ quota đồng thời (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({ ...dataSourceOptions, synchronize: true });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('10 lệnh trừ 1 vé đồng thời trên zone chỉ còn 5 vé -> đúng 5 lệnh thành công', async () => {
    const merchantRepo = dataSource.getRepository(MerchantOrmEntity);
    const merchant = await merchantRepo.save(
      merchantRepo.create({ name: 'Merchant test', code: `test-${Date.now()}` } as any),
    );

    const productRepo = dataSource.getRepository(TicketProductOrmEntity);
    const product = await productRepo.save(
      productRepo.create({
        merchantId: merchant.uuid,
        name: 'Vé test oversell',
        priceAmount: 10000,
        priceCurrency: 'VND',
        validityType: 'DAY_PASS',
        usageType: 'UNLIMITED_USE',
        status: 'PUBLISHED',
      }),
    );

    const zoneRepo = dataSource.getRepository(TicketZoneOrmEntity);
    const zone = await zoneRepo.save(
      zoneRepo.create({ ticketProductId: product.uuid, name: 'DEFAULT', quota: 5 }),
    );

    const attempts = Array.from({ length: 10 }, () =>
      dataSource
        .createQueryBuilder()
        .update(TicketZoneOrmEntity)
        .set({ quota: () => 'quota - 1' })
        .where('uuid = :zoneId AND quota >= 1', { zoneId: zone.uuid })
        .execute(),
    );

    const results = await Promise.all(attempts);
    const successCount = results.filter((r) => r.affected === 1).length;

    expect(successCount).toBe(5);

    const finalZone = await zoneRepo.findOneOrFail({ where: { uuid: zone.uuid } });
    expect(finalZone.quota).toBe(0);
  });
});
