import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import type { IMessagingGateway } from '../../domain/services/messaging-gateway.interface';
import { MESSAGING_GATEWAYS } from './messaging-gateways.token';

@Injectable()
export class IntegrationGatewayFactory {
  private readonly gatewayMap = new Map<
    IntegrationProviderEnum,
    IMessagingGateway
  >();

  constructor(@Inject(MESSAGING_GATEWAYS) gateways: IMessagingGateway[]) {
    for (const gateway of gateways) {
      this.gatewayMap.set(gateway.getProvider(), gateway);
    }
  }

  getMessagingGateway(provider: IntegrationProviderEnum): IMessagingGateway {
    const gateway = this.gatewayMap.get(provider);
    if (!gateway) {
      throw new BadRequestException(
        `Nhà cung cấp tích hợp [${provider}] chưa được hỗ trợ.`,
      );
    }
    return gateway;
  }
}
