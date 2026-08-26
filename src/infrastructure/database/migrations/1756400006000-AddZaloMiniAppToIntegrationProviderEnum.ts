import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZaloMiniAppToIntegrationProviderEnum1756400006000
  implements MigrationInterface
{
  name = 'AddZaloMiniAppToIntegrationProviderEnum1756400006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "integration_connections_provider_enum" ADD VALUE IF NOT EXISTS 'ZALO_MINI_APP'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres không hỗ trợ DROP VALUE trên enum type — no-op, an toàn để bỏ qua khi rollback.
  }
}
