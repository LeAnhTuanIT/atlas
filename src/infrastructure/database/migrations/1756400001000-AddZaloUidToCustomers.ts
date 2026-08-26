import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZaloUidToCustomers1756400001000
  implements MigrationInterface
{
  name = 'AddZaloUidToCustomers1756400001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "zalo_uid" varchar(100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "customers" DROP COLUMN IF EXISTS "zalo_uid"`,
    );
  }
}
