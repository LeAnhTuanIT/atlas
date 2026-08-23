import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationStatusEnum } from '@/modules/integrations/domain/value-objects/integration-status.vo';
import { IntegrationConnectionOrmEntity } from './../entities/integration-connection.orm-entity';
import { IntegrationConnectionMapper } from './integration-connection.mapper';

describe('IntegrationConnectionMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu nghiệp vụ', () => {
    const expiresAt = new Date('2026-08-23T12:00:00Z');
    const domain = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'acc', refreshToken: 'ref', expiresAt },
      { name: 'Shop ABC' },
    );

    const orm = IntegrationConnectionMapper.toOrm(domain);
    expect(orm.uuid).toBe(domain.getUuid());
    expect(orm.merchantId).toBe('merchant-1');
    expect(orm.provider).toBe(IntegrationProviderEnum.ZALO_OA);
    expect(orm.externalId).toBe('oa-123');
    expect(orm.accessToken).toBe('acc');
    expect(orm.metadata).toEqual({ name: 'Shop ABC' });

    // Giả lập record đã có id (bigint PK) sau khi TypeORM insert
    orm.id = '1';

    const roundTripped = IntegrationConnectionMapper.toDomain(orm);
    expect(roundTripped.getUuid()).toBe(domain.getUuid());
    expect(roundTripped.getMerchantId()).toBe('merchant-1');
    expect(roundTripped.getProvider()).toBe(IntegrationProviderEnum.ZALO_OA);
    expect(roundTripped.getExternalId()).toBe('oa-123');
    expect(roundTripped.getStatus()).toBe(IntegrationStatusEnum.ACTIVE);
    expect(roundTripped.getAccessToken()).toBe('acc');
    expect(roundTripped.getTokenExpiresAt()).toEqual(expiresAt);
    expect(roundTripped.getMetadata()).toEqual({ name: 'Shop ABC' });
  });

  it('toDomain() map status EXPIRED và token null đúng', () => {
    const orm = new IntegrationConnectionOrmEntity();
    orm.id = '2';
    orm.uuid = 'uuid-2';
    orm.merchantId = 'merchant-2';
    orm.provider = IntegrationProviderEnum.ZALO_OA;
    orm.externalId = 'oa-999';
    orm.status = IntegrationStatusEnum.EXPIRED;
    orm.accessToken = null;
    orm.refreshToken = null;
    orm.tokenExpiresAt = null;
    orm.metadata = null;

    const domain = IntegrationConnectionMapper.toDomain(orm);
    expect(domain.getStatus()).toBe(IntegrationStatusEnum.EXPIRED);
    expect(domain.getAccessToken()).toBeUndefined();
    expect(domain.getTokenExpiresAt()).toBeUndefined();
    expect(domain.getMetadata()).toBeUndefined();
  });
});
