import type { IntegrationConnection } from '../models/integration-connection.aggregate';
import type { IntegrationProviderEnum } from '../value-objects/integration-provider.vo';

export interface IIntegrationConnectionRepository {
  findByMerchantAndProvider(
    merchantId: string,
    provider: IntegrationProviderEnum,
  ): Promise<IntegrationConnection | null>;
  findByExternalId(
    provider: IntegrationProviderEnum,
    externalId: string,
  ): Promise<IntegrationConnection | null>;
  findById(uuid: string): Promise<IntegrationConnection | null>;
  save(connection: IntegrationConnection): Promise<void>;
}

export const INTEGRATION_CONNECTION_REPOSITORY = Symbol(
  'IIntegrationConnectionRepository',
);
