import type { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

export class GetIntegrationStatusQuery {
  constructor(
    public readonly merchantId: string,
    public readonly provider: IntegrationProviderEnum,
  ) {}
}
