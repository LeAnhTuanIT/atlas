import { Inject, Injectable } from '@nestjs/common';
import type { IntegrationStatusEnum } from '@/modules/integrations/domain/value-objects/integration-status.vo';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import { GetIntegrationStatusQuery } from './get-integration-status.query';

export interface IntegrationStatusResult {
  connected: boolean;
  externalId?: string;
  status?: IntegrationStatusEnum;
  metadata?: Record<string, any>;
}

@Injectable()
export class GetIntegrationStatusHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
  ) {}

  async execute(
    query: GetIntegrationStatusQuery,
  ): Promise<IntegrationStatusResult> {
    const connection = await this.connectionRepo.findByMerchantAndProvider(
      query.merchantId,
      query.provider,
    );

    if (!connection) {
      return { connected: false };
    }

    return {
      connected: true,
      externalId: connection.getExternalId(),
      status: connection.getStatus(),
      metadata: connection.getMetadata(),
    };
  }
}
