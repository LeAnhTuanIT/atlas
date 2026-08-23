import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationConnectionOrmEntity } from '../entities/integration-connection.orm-entity';

export class IntegrationConnectionMapper {
  static toDomain(orm: IntegrationConnectionOrmEntity): IntegrationConnection {
    return new IntegrationConnection(
      orm.uuid,
      orm.merchantId,
      orm.provider,
      orm.externalId,
      orm.status,
      orm.accessToken ?? undefined,
      orm.refreshToken ?? undefined,
      orm.tokenExpiresAt ?? undefined,
      orm.metadata ?? undefined,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(
    domain: IntegrationConnection,
  ): IntegrationConnectionOrmEntity {
    const orm = new IntegrationConnectionOrmEntity();
    orm.uuid = domain.getUuid();
    orm.merchantId = domain.getMerchantId();
    orm.provider = domain.getProvider();
    orm.externalId = domain.getExternalId();
    orm.status = domain.getStatus();
    orm.accessToken = domain.getAccessToken() ?? null;
    orm.refreshToken = domain.getRefreshToken() ?? null;
    orm.tokenExpiresAt = domain.getTokenExpiresAt() ?? null;
    orm.metadata = domain.getMetadata() ?? null;
    return orm;
  }
}
