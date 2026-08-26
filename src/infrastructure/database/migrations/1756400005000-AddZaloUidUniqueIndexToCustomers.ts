import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZaloUidUniqueIndexToCustomers1756400005000
  implements MigrationInterface
{
  name = 'AddZaloUidUniqueIndexToCustomers1756400005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customers_merchant_zalo_uid" ON "customers" ("merchant_id", "zalo_uid") WHERE "zalo_uid" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_customers_merchant_zalo_uid"`,
    );
  }
}
