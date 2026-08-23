import { Inject, Injectable } from '@nestjs/common';
import type { IOAuthConnectable } from '@/modules/integrations/domain/services/oauth-connectable.interface';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import { ZALO_OA_OAUTH_CONNECTABLE } from '../../ports/zalo-oa-oauth-connectable.token';
import { LinkZaloOaCommand } from './link-zalo-oa.command';

@Injectable()
export class LinkZaloOaHandler {
  constructor(
    @Inject(ZALO_OA_OAUTH_CONNECTABLE)
    private readonly oauthGateway: IOAuthConnectable,
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
  ) {}

  async execute(cmd: LinkZaloOaCommand): Promise<IntegrationConnection> {
    const tokens = await this.oauthGateway.exchangeCode(cmd.code);
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    const existing = await this.connectionRepo.findByMerchantAndProvider(
      cmd.merchantId,
      IntegrationProviderEnum.ZALO_OA,
    );

    if (existing) {
      existing.updateTokens({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      });
      await this.connectionRepo.save(existing);
      return existing;
    }

    const connection = IntegrationConnection.create(
      cmd.merchantId,
      IntegrationProviderEnum.ZALO_OA,
      cmd.oaId,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt,
      },
    );
    await this.connectionRepo.save(connection);
    return connection;
  }
}
