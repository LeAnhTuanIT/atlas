import { BaseEntity } from '@/shared/domain/base.entity';
import { IntegrationProviderEnum } from '../value-objects/integration-provider.vo';
import { IntegrationStatusEnum } from '../value-objects/integration-status.vo';

export interface IntegrationTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export class IntegrationConnection extends BaseEntity<string> {
  constructor(
    uuid: string,
    private readonly merchantId: string,
    private readonly provider: IntegrationProviderEnum,
    private externalId: string,
    private status: IntegrationStatusEnum,
    private accessToken: string | undefined,
    private refreshToken: string | undefined,
    private tokenExpiresAt: Date | undefined,
    private metadata: Record<string, any> | undefined,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(uuid, createdAt, updatedAt);
  }

  static create(
    merchantId: string,
    provider: IntegrationProviderEnum,
    externalId: string,
    tokens: IntegrationTokenSet,
    metadata?: Record<string, any>,
  ): IntegrationConnection {
    return new IntegrationConnection(
      crypto.randomUUID(),
      merchantId,
      provider,
      externalId,
      IntegrationStatusEnum.ACTIVE,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
      metadata,
    );
  }

  updateTokens(tokens: IntegrationTokenSet): void {
    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;
    this.tokenExpiresAt = tokens.expiresAt;
    this.status = IntegrationStatusEnum.ACTIVE;
    this._updatedAt = new Date();
  }

  markExpired(): void {
    this.status = IntegrationStatusEnum.EXPIRED;
    this._updatedAt = new Date();
  }

  isTokenExpiringSoon(withinMs = 5 * 60 * 1000): boolean {
    if (!this.tokenExpiresAt) return true;
    return this.tokenExpiresAt.getTime() - Date.now() < withinMs;
  }

  getUuid(): string {
    return this.id;
  }
  getMerchantId(): string {
    return this.merchantId;
  }
  getProvider(): IntegrationProviderEnum {
    return this.provider;
  }
  getExternalId(): string {
    return this.externalId;
  }
  getStatus(): IntegrationStatusEnum {
    return this.status;
  }
  getAccessToken(): string | undefined {
    return this.accessToken;
  }
  getRefreshToken(): string | undefined {
    return this.refreshToken;
  }
  getTokenExpiresAt(): Date | undefined {
    return this.tokenExpiresAt;
  }
  getMetadata(): Record<string, any> | undefined {
    return this.metadata;
  }
}
