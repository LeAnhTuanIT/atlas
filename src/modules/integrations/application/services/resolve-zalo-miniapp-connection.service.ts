import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationStatusEnum } from '@/modules/integrations/domain/value-objects/integration-status.vo';

export interface ZaloMiniAppCredentials {
  merchantId: string;
  zaloAppId: string;
  zaloAppSecret: string;
}

@Injectable()
export class ResolveZaloMiniAppConnectionService {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
  ) {}

  async resolveByMiniAppId(
    zaloMiniAppId: string,
  ): Promise<ZaloMiniAppCredentials> {
    const connection = await this.connectionRepo.findByExternalId(
      IntegrationProviderEnum.ZALO_MINI_APP,
      zaloMiniAppId,
    );

    if (!connection) {
      throw new NotFoundException(
        'Mini App chưa được liên kết với merchant nào.',
      );
    }

    if (connection.getStatus() !== IntegrationStatusEnum.ACTIVE) {
      throw new ForbiddenException('Liên kết Zalo Mini App đã bị vô hiệu hoá.');
    }

    const metadata = connection.getMetadata() || {};
    return {
      merchantId: connection.getMerchantId(),
      zaloAppId: metadata.zaloAppId,
      zaloAppSecret: metadata.zaloAppSecret,
    };
  }
}
