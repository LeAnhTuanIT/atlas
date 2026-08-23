import { BadRequestException } from '@nestjs/common';
import { IntegrationGatewayFactory } from './integration-gateway.factory';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import type { IMessagingGateway } from '../../domain/services/messaging-gateway.interface';

class FakeZaloGateway implements IMessagingGateway {
  getProvider() {
    return IntegrationProviderEnum.ZALO_OA;
  }
  async sendMessage() {
    return { externalMessageId: 'fake-msg' };
  }
}

describe('IntegrationGatewayFactory', () => {
  it('trả về gateway đúng theo provider', () => {
    const factory = new IntegrationGatewayFactory([new FakeZaloGateway()]);
    const gw = factory.getMessagingGateway(IntegrationProviderEnum.ZALO_OA);
    expect(gw.getProvider()).toBe(IntegrationProviderEnum.ZALO_OA);
  });

  it('throw BadRequestException khi provider chưa được đăng ký', () => {
    const factory = new IntegrationGatewayFactory([new FakeZaloGateway()]);
    expect(() =>
      factory.getMessagingGateway(IntegrationProviderEnum.ESMS),
    ).toThrow(BadRequestException);
  });
});
