import { IntegrationConnection } from './integration-connection.aggregate';
import { IntegrationProviderEnum } from '../value-objects/integration-provider.vo';
import { IntegrationStatusEnum } from '../value-objects/integration-status.vo';

describe('IntegrationConnection', () => {
  const tokens = {
    accessToken: 'acc-1',
    refreshToken: 'ref-1',
    expiresAt: new Date(Date.now() + 3600_000),
  };

  it('create() khởi tạo với status ACTIVE', () => {
    const conn = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      tokens,
    );

    expect(conn.getMerchantId()).toBe('merchant-1');
    expect(conn.getProvider()).toBe(IntegrationProviderEnum.ZALO_OA);
    expect(conn.getExternalId()).toBe('oa-123');
    expect(conn.getStatus()).toBe(IntegrationStatusEnum.ACTIVE);
    expect(conn.getAccessToken()).toBe('acc-1');
    expect(conn.getUuid()).toEqual(expect.any(String));
  });

  it('updateTokens() cập nhật token và set lại ACTIVE', () => {
    const conn = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      tokens,
    );
    conn.markExpired();

    const newExpiry = new Date(Date.now() + 7200_000);
    conn.updateTokens({
      accessToken: 'acc-2',
      refreshToken: 'ref-2',
      expiresAt: newExpiry,
    });

    expect(conn.getAccessToken()).toBe('acc-2');
    expect(conn.getRefreshToken()).toBe('ref-2');
    expect(conn.getTokenExpiresAt()).toEqual(newExpiry);
    expect(conn.getStatus()).toBe(IntegrationStatusEnum.ACTIVE);
  });

  it('isTokenExpiringSoon() trả true khi còn dưới ngưỡng', () => {
    const conn = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { ...tokens, expiresAt: new Date(Date.now() + 60_000) }, // còn 1 phút
    );

    expect(conn.isTokenExpiringSoon(5 * 60 * 1000)).toBe(true);
    expect(conn.isTokenExpiringSoon(30_000)).toBe(false);
  });

  it('markExpired() set status EXPIRED', () => {
    const conn = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      tokens,
    );
    conn.markExpired();
    expect(conn.getStatus()).toBe(IntegrationStatusEnum.EXPIRED);
  });
});
