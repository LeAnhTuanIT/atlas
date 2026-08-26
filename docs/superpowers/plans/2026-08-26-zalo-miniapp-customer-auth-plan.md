# Zalo Mini App Customer Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `POST /v1/auth/zalo-miniapp/login` to the `atlas` NestJS backend so a customer can authenticate from a per-merchant Zalo Mini App and land on the exact same `Customer` record (and cookie/JWT mechanism) used by the future customer-facing website.

**Architecture:** New CQRS command `ZaloMiniAppLoginCommand`/`Handler` in `modules/auth`, backed by a new `ZaloMiniAppGateway` and `ResolveZaloMiniAppConnectionService` in `modules/integrations` (mirroring the existing `ZaloOaGateway`/`ResolveZaloOaConnectionService` pattern). The handler verifies the Zalo access token and phone token directly against Zalo's Graph API (never trusting client-supplied identity), then auto-links or JIT-provisions a `Customer` by `(merchantId, zaloUid)` / `(merchantId, phone)`, and issues tokens through the existing `TOKEN_GENERATOR_PORT` + `CookieUtil` — identical to the `CUSTOMER` scope path already used by `UnifiedLoginCommand`.

**Tech Stack:** NestJS 10, TypeORM (Postgres, `synchronize: true`), CQRS (`@nestjs/cqrs`), `axios` for outbound Zalo API calls, Jest for unit/e2e tests, `class-validator` for DTOs.

**Spec:** `docs/superpowers/specs/2026-08-26-zalo-miniapp-customer-auth-design.md`

## Global Constraints

- Scope is **backend only** (`atlas`). The Zalo Mini App frontend (`artemis`) was just re-scaffolded without `zmp-ui`/`zmp-sdk` and is out of scope — it gets its own plan once set up.
- Client-supplied `merchantId` must never be trusted for tenant selection — `merchantId` is always derived server-side from `zaloMiniAppId` via `IntegrationConnection`.
- Client-supplied `uid` must never be written to the DB directly — always use the `realUid` returned by Zalo's own API for the given `accessToken`, and reject the request if the two don't match.
- Reuse `TOKEN_GENERATOR_PORT`, `CookieUtil`, `COOKIE_KEYS`, and the `CUSTOMER` JWT scope exactly as `UnifiedLoginHandler` does — no new token/cookie mechanism.
- Follow the existing `ZaloOaGateway` conventions exactly: `axios` + try/catch, `Logger`, mock-mode flag read from `ConfigService`, and `BadGatewayException` for any rejected/failed Zalo API call. `UnauthorizedException`/`ForbiddenException`/`ConflictException`/`NotFoundException` are for local business-rule checks (missing connection, uid mismatch, blocked account, phone/zaloUid conflict), not for Zalo API response parsing.
- No new encryption layer for `zaloAppSecret` — the existing `IntegrationConnectionOrmEntity.metadata` column is plain `jsonb` (the codebase does not currently encrypt `ZALO_OA` tokens at rest either); store it the same way for consistency. Do not invent encryption that doesn't exist elsewhere in this codebase.
- `synchronize: true` is on in `data-source.ts`, but this repo still writes explicit migration files for every schema change (see `1756400001000-AddZaloUidToCustomers.ts`) — keep following that convention.

---

## File Structure

```
atlas/src/modules/customers/
  domain/models/customer.model.ts                                  [MODIFY] add linkZaloAccount()
  domain/repositories/customer.repository.interface.ts              [MODIFY] add findByZaloUid()
  infrastructure/persistence/repositories/customer.typeorm-repository.ts [MODIFY] implement findByZaloUid()
  infrastructure/persistence/entities/customer.orm-entity.ts        [MODIFY] unique partial index

atlas/src/modules/integrations/
  domain/value-objects/integration-provider.vo.ts                   [MODIFY] add ZALO_MINI_APP
  infrastructure/gateways/zalo-miniapp.gateway.ts                   [CREATE]
  infrastructure/gateways/zalo-miniapp.gateway.spec.ts               [CREATE]
  application/services/resolve-zalo-miniapp-connection.service.ts    [CREATE]
  application/services/resolve-zalo-miniapp-connection.service.spec.ts [CREATE]
  integrations.module.ts                                             [MODIFY] register + export new providers

atlas/src/modules/auth/
  application/dtos/zalo-miniapp-login.dto.ts                        [CREATE]
  application/commands/zalo-miniapp-login/zalo-miniapp-login.command.ts [CREATE]
  application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.ts [CREATE]
  application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.spec.ts [CREATE]
  presentation/http/auth.controller.ts                               [MODIFY] new route + DRY cookie helper
  auth.module.ts                                                     [MODIFY] import IntegrationsModule, register handler

atlas/src/infrastructure/configs/env.validation.ts                   [MODIFY] add ZALO_MINIAPP_MOCK_MODE

atlas/src/infrastructure/database/migrations/
  1756400005000-AddZaloUidUniqueIndexToCustomers.ts                  [CREATE]
  1756400006000-AddZaloMiniAppToIntegrationProviderEnum.ts            [CREATE]

atlas/test/
  zalo-miniapp-login.e2e-spec.ts                                     [CREATE]
```

---

### Task 1: Customer domain — link Zalo account + repository lookup

**Files:**
- Modify: `src/modules/customers/domain/models/customer.model.ts`
- Modify: `src/modules/customers/domain/repositories/customer.repository.interface.ts`
- Modify: `src/modules/customers/infrastructure/persistence/repositories/customer.typeorm-repository.ts`
- Test: `src/modules/customers/domain/models/customer.model.spec.ts` (new)

**Interfaces:**
- Produces: `Customer.linkZaloAccount(zaloUid: string): void` (sets `zaloUid` + bumps `updatedAt`); `ICustomerRepository.findByZaloUid(merchantId: string, zaloUid: string): Promise<Customer | null>`.
- Consumes: existing `Customer.reconstitute`/`Customer.create`, `CustomerOrmEntity.zaloUid`, `CustomerMapper.toDomain`.

- [ ] **Step 1: Write the failing test for `linkZaloAccount`**

Create `src/modules/customers/domain/models/customer.model.spec.ts`:

```ts
import { Customer, CustomerStatus } from './customer.model';
import { CustomerId } from '../value-objects/customer-id.vo';
import { PhoneNumber } from '../value-objects/phone.vo';

describe('Customer.linkZaloAccount', () => {
  it('gán zaloUid và cập nhật updatedAt', () => {
    const customer = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.ACTIVE,
      loyaltyPoints: 0,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    customer.linkZaloAccount('zalo-uid-123');

    expect(customer.zaloUid).toBe('zalo-uid-123');
    expect(customer.updatedAt.getTime()).toBeGreaterThan(
      new Date('2026-01-01T00:00:00Z').getTime(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/modules/customers/domain/models/customer.model.spec.ts`
Expected: FAIL with `customer.linkZaloAccount is not a function`

- [ ] **Step 3: Implement `linkZaloAccount` on the domain model**

In `src/modules/customers/domain/models/customer.model.ts`, add inside the `Customer` class (near `updateProfile`):

```ts
  linkZaloAccount(zaloUid: string): void {
    this.props.zaloUid = zaloUid;
    this.props.updatedAt = new Date();
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/modules/customers/domain/models/customer.model.spec.ts`
Expected: PASS

- [ ] **Step 5: Add `findByZaloUid` to the repository interface**

In `src/modules/customers/domain/repositories/customer.repository.interface.ts`, add to `ICustomerRepository`:

```ts
  findByZaloUid(merchantId: string, zaloUid: string): Promise<Customer | null>;
```

- [ ] **Step 6: Implement `findByZaloUid` in the TypeORM repository**

In `src/modules/customers/infrastructure/persistence/repositories/customer.typeorm-repository.ts`, add a method (place after `findByEmail`):

```ts
  async findByZaloUid(
    merchantId: string,
    zaloUid: string,
  ): Promise<Customer | null> {
    const entity = await this.repo.findOne({
      where: { merchantId, zaloUid },
    });
    return entity ? CustomerMapper.toDomain(entity) : null;
  }
```

- [ ] **Step 7: Run full customers module test suite**

Run: `bun run test -- src/modules/customers`
Expected: PASS (no regressions)

- [ ] **Step 8: Commit**

```bash
git add src/modules/customers/domain/models/customer.model.ts \
        src/modules/customers/domain/models/customer.model.spec.ts \
        src/modules/customers/domain/repositories/customer.repository.interface.ts \
        src/modules/customers/infrastructure/persistence/repositories/customer.typeorm-repository.ts
git commit -m "feat(customers): add linkZaloAccount and findByZaloUid for Zalo auto-link"
```

---

### Task 2: Unique partial index on `customers.zalo_uid`

**Files:**
- Modify: `src/modules/customers/infrastructure/persistence/entities/customer.orm-entity.ts:1-19` (index decorators near the top of the class)
- Create: `src/infrastructure/database/migrations/1756400005000-AddZaloUidUniqueIndexToCustomers.ts`

**Interfaces:**
- Produces: DB constraint `UQ_customers_merchant_zalo_uid` guaranteeing one `zaloUid` per merchant. No code-level interface — this is a schema-only task consumed by Task 5 (JIT provisioning must rely on this constraint for the duplicate-key race-condition path).

- [ ] **Step 1: Add the partial unique index to the entity**

In `src/modules/customers/infrastructure/persistence/entities/customer.orm-entity.ts`, next to the existing `@Index(['merchantId', 'phone'], ...)` decorators on the class, add:

```ts
@Index('UQ_customers_merchant_zalo_uid', ['merchantId', 'zaloUid'], {
  unique: true,
  where: '"zalo_uid" IS NOT NULL',
})
```

(Keep the existing `@Entity` and other `@Index` decorators as-is — this is additive.)

- [ ] **Step 2: Write the migration**

Create `src/infrastructure/database/migrations/1756400005000-AddZaloUidUniqueIndexToCustomers.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZaloUidUniqueIndexToCustomers1756400005000
  implements MigrationInterface
{
  name = 'AddZaloUidUniqueIndexToCustomers1756400005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_customers_merchant_zalo_uid" ON "customers" ("merchant_id", "zalo_uid") WHERE "zalo_uid" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_customers_merchant_zalo_uid"`,
    );
  }
}
```

- [ ] **Step 3: Run the migration against the local dev DB**

Run: `bun run migration:run`
Expected: Output lists `AddZaloUidUniqueIndexToCustomers1756400005000` as executed, no errors.

- [ ] **Step 4: Verify the index manually**

Run: `psql "$DATABASE_URL" -c '\d customers'` (or your local psql connection string)
Expected: `"UQ_customers_merchant_zalo_uid" UNIQUE, btree (merchant_id, zalo_uid) WHERE zalo_uid IS NOT NULL` appears in the indexes list.

- [ ] **Step 5: Commit**

```bash
git add src/modules/customers/infrastructure/persistence/entities/customer.orm-entity.ts \
        src/infrastructure/database/migrations/1756400005000-AddZaloUidUniqueIndexToCustomers.ts
git commit -m "feat(customers): add unique partial index on (merchantId, zaloUid)"
```

---

### Task 3: `IntegrationProviderEnum.ZALO_MINI_APP` + env flag

**Files:**
- Modify: `src/modules/integrations/domain/value-objects/integration-provider.vo.ts`
- Modify: `src/infrastructure/configs/env.validation.ts`
- Create: `src/infrastructure/database/migrations/1756400006000-AddZaloMiniAppToIntegrationProviderEnum.ts`

**Interfaces:**
- Produces: `IntegrationProviderEnum.ZALO_MINI_APP` — consumed by Task 4 (gateway), Task 5 (resolve service), and any future admin UI that lets a merchant register their Mini App credentials.

- [ ] **Step 1: Add the enum value**

In `src/modules/integrations/domain/value-objects/integration-provider.vo.ts`:

```ts
export enum IntegrationProviderEnum {
  ZALO_OA = 'ZALO_OA',
  ZALO_MINI_APP = 'ZALO_MINI_APP',
  ESMS = 'ESMS',
}
```

- [ ] **Step 2: Add the mock-mode env var**

In `src/infrastructure/configs/env.validation.ts`, in the `// Zalo OA` block, add a sibling line right after `ZALO_OA_MOCK_CALLBACK_URL`:

```ts
  // Zalo Mini App (per-merchant credentials live in integration_connections, not env)
  ZALO_MINIAPP_MOCK_MODE: z.string().optional(),
```

- [ ] **Step 3: Write the migration to extend the Postgres enum type**

Create `src/infrastructure/database/migrations/1756400006000-AddZaloMiniAppToIntegrationProviderEnum.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddZaloMiniAppToIntegrationProviderEnum1756400006000
  implements MigrationInterface
{
  name = 'AddZaloMiniAppToIntegrationProviderEnum1756400006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "integration_connections_provider_enum" ADD VALUE IF NOT EXISTS 'ZALO_MINI_APP'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres không hỗ trợ DROP VALUE trên enum type — no-op, an toàn để bỏ qua khi rollback.
  }
}
```

- [ ] **Step 4: Run the migration**

Run: `bun run migration:run`
Expected: Executes without error. If it fails with `unsafe use of new value "ZALO_MINI_APP" of enum type` (Postgres forbids using a brand-new enum value in the same transaction it was added in), that's expected and fine — it only affects using the value in the *same* migration run, not later requests.

- [ ] **Step 5: Verify**

Run: `psql "$DATABASE_URL" -c "SELECT unnest(enum_range(NULL::integration_connections_provider_enum))"`
Expected: Output includes `ZALO_OA`, `ZALO_MINI_APP`, `ESMS`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/domain/value-objects/integration-provider.vo.ts \
        src/infrastructure/configs/env.validation.ts \
        src/infrastructure/database/migrations/1756400006000-AddZaloMiniAppToIntegrationProviderEnum.ts
git commit -m "feat(integrations): add ZALO_MINI_APP provider"
```

---

### Task 4: `ZaloMiniAppGateway`

**Files:**
- Create: `src/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway.ts`
- Create: `src/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway.spec.ts`

**Interfaces:**
- Consumes: `ConfigService` (for `ZALO_MINIAPP_MOCK_MODE`), nothing else — this gateway is stateless per-call, all Zalo App credentials are passed in as arguments (they come from `IntegrationConnection`, resolved by Task 5).
- Produces:
  ```ts
  export interface ZaloMiniAppProfile { uid: string; name: string; avatar?: string; }
  class ZaloMiniAppGateway {
    getProfile(accessToken: string): Promise<ZaloMiniAppProfile>;
    getPhoneNumber(accessToken: string, phoneToken: string, zaloAppSecret: string): Promise<string>;
  }
  ```
  Both methods throw `BadGatewayException` if Zalo rejects the call or the request fails.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway.spec.ts`:

```ts
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException } from '@nestjs/common';
import { ZaloMiniAppGateway } from './zalo-miniapp.gateway';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZaloMiniAppGateway', () => {
  const configService = {
    get: jest.fn(() => undefined),
  } as unknown as ConfigService;

  const gateway = new ZaloMiniAppGateway(configService);

  beforeEach(() => jest.clearAllMocks());

  describe('getProfile', () => {
    it('trả về uid/name/avatar khi Zalo phản hồi thành công', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { id: 'zalo-uid-1', name: 'Nguyễn Văn A', picture: { data: { url: 'http://x/avatar.png' } } },
      });

      const profile = await gateway.getProfile('acc-token');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.zalo.me/v2.0/me',
        expect.objectContaining({
          params: { access_token: 'acc-token', fields: 'id,name,picture' },
        }),
      );
      expect(profile).toEqual({
        uid: 'zalo-uid-1',
        name: 'Nguyễn Văn A',
        avatar: 'http://x/avatar.png',
      });
    });

    it('ném BadGatewayException khi Zalo trả lỗi (accessToken invalid)', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { error: -216, message: 'Access token is invalid' },
      });

      await expect(gateway.getProfile('bad-token')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('ném BadGatewayException khi gọi Zalo API lỗi network', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('timeout'));

      await expect(gateway.getProfile('acc-token')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('getPhoneNumber', () => {
    it('trả về số điện thoại khi giải mã thành công', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { data: { number: '84912345678' } },
      });

      const phone = await gateway.getPhoneNumber(
        'acc-token',
        'phone-token',
        'app-secret',
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://graph.zalo.me/v2.0/me/info',
        expect.objectContaining({
          params: {
            access_token: 'acc-token',
            code: 'phone-token',
            secret_key: 'app-secret',
          },
        }),
      );
      expect(phone).toBe('84912345678');
    });

    it('ném BadGatewayException khi phoneToken hết hạn/sai', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { error: -230, message: 'Invalid code' },
      });

      await expect(
        gateway.getPhoneNumber('acc-token', 'bad-token', 'app-secret'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway.spec.ts`
Expected: FAIL — `Cannot find module './zalo-miniapp.gateway'`

- [ ] **Step 3: Implement the gateway**

Create `src/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway.ts`:

```ts
import { Injectable, Logger, BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

const ZALO_GRAPH_ME_URL = 'https://graph.zalo.me/v2.0/me';
const ZALO_GRAPH_ME_INFO_URL = 'https://graph.zalo.me/v2.0/me/info';

export interface ZaloMiniAppProfile {
  uid: string;
  name: string;
  avatar?: string;
}

@Injectable()
export class ZaloMiniAppGateway {
  private readonly logger = new Logger(ZaloMiniAppGateway.name);

  constructor(private readonly configService: ConfigService) {}

  private isMock(): boolean {
    return this.configService.get<string>('ZALO_MINIAPP_MOCK_MODE') === 'true';
  }

  async getProfile(accessToken: string): Promise<ZaloMiniAppProfile> {
    if (this.isMock()) {
      return { uid: `mock_uid_${accessToken}`, name: 'Khách hàng Mock' };
    }

    try {
      const response = await axios.get(ZALO_GRAPH_ME_URL, {
        params: { access_token: accessToken, fields: 'id,name,picture' },
      });

      const data = response.data;
      if (data?.error || !data?.id) {
        this.logger.error(`Zalo Mini App getProfile error: ${JSON.stringify(data)}`);
        throw new BadGatewayException(
          `Zalo từ chối accessToken: ${data?.message || 'unknown error'}`,
        );
      }

      return {
        uid: data.id,
        name: data.name || '',
        avatar: data.picture?.data?.url,
      };
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const errorMsg = error?.response?.data || error?.message;
      this.logger.error(`Lỗi gọi Zalo Mini App getProfile API: ${JSON.stringify(errorMsg)}`);
      throw new BadGatewayException('Không thể xác thực người dùng qua Zalo.');
    }
  }

  async getPhoneNumber(
    accessToken: string,
    phoneToken: string,
    zaloAppSecret: string,
  ): Promise<string> {
    if (this.isMock()) {
      return '84900000000';
    }

    try {
      const response = await axios.get(ZALO_GRAPH_ME_INFO_URL, {
        params: {
          access_token: accessToken,
          code: phoneToken,
          secret_key: zaloAppSecret,
        },
      });

      const data = response.data;
      const number = data?.data?.number;
      if (data?.error || !number) {
        this.logger.error(`Zalo Mini App getPhoneNumber error: ${JSON.stringify(data)}`);
        throw new BadGatewayException(
          `Zalo từ chối giải mã số điện thoại: ${data?.message || 'unknown error'}`,
        );
      }

      return number;
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const errorMsg = error?.response?.data || error?.message;
      this.logger.error(`Lỗi gọi Zalo Mini App getPhoneNumber API: ${JSON.stringify(errorMsg)}`);
      throw new BadGatewayException('Không thể lấy số điện thoại từ Zalo.');
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway.ts \
        src/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway.spec.ts
git commit -m "feat(integrations): add ZaloMiniAppGateway for profile/phone verification"
```

---

### Task 5: `ResolveZaloMiniAppConnectionService`

**Files:**
- Create: `src/modules/integrations/application/services/resolve-zalo-miniapp-connection.service.ts`
- Create: `src/modules/integrations/application/services/resolve-zalo-miniapp-connection.service.spec.ts`

**Interfaces:**
- Consumes: `IIntegrationConnectionRepository.findByExternalId(provider, externalId)` (already exists), `IntegrationProviderEnum.ZALO_MINI_APP` (Task 3), `IntegrationConnection.getMerchantId()/getMetadata()/getStatus()` (already exist).
- Produces:
  ```ts
  export interface ZaloMiniAppCredentials {
    merchantId: string;
    zaloAppId: string;
    zaloAppSecret: string;
  }
  class ResolveZaloMiniAppConnectionService {
    resolveByMiniAppId(zaloMiniAppId: string): Promise<ZaloMiniAppCredentials>;
  }
  ```
  Throws `NotFoundException` if no connection exists, or `ForbiddenException` if the connection is not `ACTIVE` — consumed directly by Task 7's handler.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/integrations/application/services/resolve-zalo-miniapp-connection.service.spec.ts`:

```ts
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ResolveZaloMiniAppConnectionService } from './resolve-zalo-miniapp-connection.service';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationStatusEnum } from '@/modules/integrations/domain/value-objects/integration-status.vo';

describe('ResolveZaloMiniAppConnectionService', () => {
  const connectionRepo = { findByExternalId: jest.fn() } as any;
  const service = new ResolveZaloMiniAppConnectionService(connectionRepo);

  beforeEach(() => jest.clearAllMocks());

  it('trả về merchantId/zaloAppId/zaloAppSecret khi connection ACTIVE tồn tại', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_MINI_APP,
      'mini-app-123',
      { accessToken: '', refreshToken: '', expiresAt: new Date('2999-01-01') },
      { zaloAppId: 'app-1', zaloAppSecret: 'secret-1' },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);

    const result = await service.resolveByMiniAppId('mini-app-123');

    expect(connectionRepo.findByExternalId).toHaveBeenCalledWith(
      IntegrationProviderEnum.ZALO_MINI_APP,
      'mini-app-123',
    );
    expect(result).toEqual({
      merchantId: 'merchant-1',
      zaloAppId: 'app-1',
      zaloAppSecret: 'secret-1',
    });
  });

  it('ném NotFoundException khi không tìm thấy connection', async () => {
    connectionRepo.findByExternalId.mockResolvedValueOnce(null);

    await expect(service.resolveByMiniAppId('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('ném ForbiddenException khi connection bị revoke', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_MINI_APP,
      'mini-app-123',
      { accessToken: '', refreshToken: '', expiresAt: new Date('2999-01-01') },
      { zaloAppId: 'app-1', zaloAppSecret: 'secret-1' },
    );
    connection.revoke();
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);

    await expect(service.resolveByMiniAppId('mini-app-123')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/modules/integrations/application/services/resolve-zalo-miniapp-connection.service.spec.ts`
Expected: FAIL — `Cannot find module './resolve-zalo-miniapp-connection.service'`

- [ ] **Step 3: Implement the service**

Create `src/modules/integrations/application/services/resolve-zalo-miniapp-connection.service.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/modules/integrations/application/services/resolve-zalo-miniapp-connection.service.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/integrations/application/services/resolve-zalo-miniapp-connection.service.ts \
        src/modules/integrations/application/services/resolve-zalo-miniapp-connection.service.spec.ts
git commit -m "feat(integrations): add ResolveZaloMiniAppConnectionService"
```

---

### Task 6: Wire new providers into `IntegrationsModule`

**Files:**
- Modify: `src/modules/integrations/integrations.module.ts`

**Interfaces:**
- Consumes: `ZaloMiniAppGateway` (Task 4), `ResolveZaloMiniAppConnectionService` (Task 5).
- Produces: both exported from `IntegrationsModule` so `AuthModule` (Task 9) can inject them after importing `IntegrationsModule`.

- [ ] **Step 1: Add imports**

In `src/modules/integrations/integrations.module.ts`, add near the other gateway/service imports:

```ts
import { ZaloMiniAppGateway } from './infrastructure/gateways/zalo-miniapp.gateway';
import { ResolveZaloMiniAppConnectionService } from './application/services/resolve-zalo-miniapp-connection.service';
```

- [ ] **Step 2: Register as providers and export**

In the same file, add `ZaloMiniAppGateway` and `ResolveZaloMiniAppConnectionService` to the `providers` array (near `ZaloOaGateway`, `ResolveZaloOaConnectionService`), and add both to the `exports` array alongside `INTEGRATION_CONNECTION_REPOSITORY`.

- [ ] **Step 3: Run the module's existing tests to confirm no regressions**

Run: `bun run test -- src/modules/integrations`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/modules/integrations/integrations.module.ts
git commit -m "feat(integrations): export ZaloMiniAppGateway and resolve service"
```

---

### Task 7: `ZaloMiniAppLoginDto` + `ZaloMiniAppLoginCommand`

**Files:**
- Create: `src/modules/auth/application/dtos/zalo-miniapp-login.dto.ts`
- Create: `src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.command.ts`

**Interfaces:**
- Produces: `ZaloMiniAppLoginDto { zaloMiniAppId: string; uid: string; accessToken: string; phoneToken: string }` and `ZaloMiniAppLoginCommand(zaloMiniAppId, uid, accessToken, phoneToken)` — consumed by the controller (Task 10) and the handler (Task 8).

This task has no independent runtime behavior to unit-test (pure DTO/command shape) — it's validated by Task 8's handler tests and the e2e test in Task 11. Still commit it standalone since Task 8 depends on the exact class names.

- [ ] **Step 1: Create the DTO**

Create `src/modules/auth/application/dtos/zalo-miniapp-login.dto.ts`:

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class ZaloMiniAppLoginDto {
  @IsNotEmpty({ message: 'zaloMiniAppId không được để trống' })
  @IsString()
  zaloMiniAppId: string;

  @IsNotEmpty({ message: 'uid không được để trống' })
  @IsString()
  uid: string;

  @IsNotEmpty({ message: 'accessToken không được để trống' })
  @IsString()
  accessToken: string;

  @IsNotEmpty({ message: 'phoneToken không được để trống' })
  @IsString()
  phoneToken: string;
}
```

- [ ] **Step 2: Create the command**

Create `src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.command.ts`:

```ts
export class ZaloMiniAppLoginCommand {
  constructor(
    public readonly zaloMiniAppId: string,
    public readonly uid: string,
    public readonly accessToken: string,
    public readonly phoneToken: string,
  ) {}
}
```

- [ ] **Step 3: Verify the project still compiles**

Run: `bun run build` (or `bunx tsc --noEmit` if `build` is slow) 
Expected: No new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/application/dtos/zalo-miniapp-login.dto.ts \
        src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.command.ts
git commit -m "feat(auth): add ZaloMiniAppLoginDto and command"
```

---

### Task 8: `ZaloMiniAppLoginHandler`

**Files:**
- Create: `src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.ts`
- Test: `src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.spec.ts`

**Interfaces:**
- Consumes:
  - `ResolveZaloMiniAppConnectionService.resolveByMiniAppId(zaloMiniAppId): Promise<ZaloMiniAppCredentials>` (Task 5)
  - `ZaloMiniAppGateway.getProfile(accessToken): Promise<ZaloMiniAppProfile>` and `.getPhoneNumber(accessToken, phoneToken, zaloAppSecret): Promise<string>` (Task 4)
  - `ICustomerRepository.findByZaloUid/findByPhone/save` (Task 1), `Customer.create/linkZaloAccount` (Task 1)
  - `Repository<MerchantOrmEntity>` (existing, same as `UnifiedLoginHandler`)
  - `ITokenGeneratorPort.generateTokens(payload): Promise<AuthTokens>` (existing)
  - `PhoneNumber` VO (existing, `src/modules/customers/domain/value-objects/phone.vo.ts`)
- Produces: `UnifiedLoginResult` (same shape already exported from `unified-login.handler.ts`) — the controller (Task 10) treats both handlers' results identically.

- [ ] **Step 1: Write the failing test file (happy paths + edge cases)**

Create `src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.spec.ts`:

```ts
import {
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ZaloMiniAppLoginHandler } from './zalo-miniapp-login.handler';
import { ZaloMiniAppLoginCommand } from './zalo-miniapp-login.command';
import { Customer, CustomerStatus } from '@/modules/customers/domain/models/customer.model';
import { CustomerId } from '@/modules/customers/domain/value-objects/customer-id.vo';
import { PhoneNumber } from '@/modules/customers/domain/value-objects/phone.vo';
import { MerchantStatus } from '@/modules/merchant/domain/models/merchant.aggregate';

describe('ZaloMiniAppLoginHandler', () => {
  const resolveConnection = { resolveByMiniAppId: jest.fn() } as any;
  const gateway = { getProfile: jest.fn(), getPhoneNumber: jest.fn() } as any;
  const customerRepo = {
    findByZaloUid: jest.fn(),
    findByPhone: jest.fn(),
    save: jest.fn(),
  } as any;
  const merchantRepo = { findOne: jest.fn() } as any;
  const tokenGenerator = { generateTokens: jest.fn() } as any;

  const handler = new ZaloMiniAppLoginHandler(
    resolveConnection,
    gateway,
    customerRepo,
    merchantRepo,
    tokenGenerator,
  );

  const command = new ZaloMiniAppLoginCommand(
    'mini-app-123',
    'zalo-uid-1',
    'acc-token',
    'phone-token',
  );

  const baseConnection = {
    merchantId: 'merchant-1',
    zaloAppId: 'app-1',
    zaloAppSecret: 'secret-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resolveConnection.resolveByMiniAppId.mockResolvedValue(baseConnection);
    gateway.getProfile.mockResolvedValue({ uid: 'zalo-uid-1', name: 'Nguyễn Văn A' });
    gateway.getPhoneNumber.mockResolvedValue('84912345678');
    merchantRepo.findOne.mockResolvedValue({ uuid: 'merchant-1', status: MerchantStatus.ACTIVE });
    tokenGenerator.generateTokens.mockResolvedValue({
      accessToken: 'jwt-access',
      refreshToken: 'jwt-refresh',
      expiresIn: 900,
    });
  });

  it('ném UnauthorizedException khi uid gửi lên khác realUid Zalo trả về', async () => {
    gateway.getProfile.mockResolvedValueOnce({ uid: 'someone-else', name: 'X' });

    await expect(handler.execute(command)).rejects.toThrow(UnauthorizedException);
    expect(customerRepo.save).not.toHaveBeenCalled();
  });

  it('ném ForbiddenException khi merchant không ACTIVE', async () => {
    merchantRepo.findOne.mockResolvedValueOnce({ uuid: 'merchant-1', status: MerchantStatus.SUSPENDED });

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });

  it('đăng nhập thẳng khi customer đã có zaloUid khớp', async () => {
    const existing = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.ACTIVE,
      loyaltyPoints: 0,
      zaloUid: 'zalo-uid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    customerRepo.findByZaloUid.mockResolvedValueOnce(existing);

    const result = await handler.execute(command);

    expect(customerRepo.save).not.toHaveBeenCalled();
    expect(result.scope).toBe('CUSTOMER');
    expect(result.user.id).toBe(existing.id.getValue());
  });

  it('auto-link khi tìm thấy customer theo SĐT chưa có zaloUid', async () => {
    const existing = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.ACTIVE,
      loyaltyPoints: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    customerRepo.findByZaloUid.mockResolvedValueOnce(null);
    customerRepo.findByPhone.mockResolvedValueOnce(existing);

    const result = await handler.execute(command);

    expect(customerRepo.save).toHaveBeenCalledWith(existing);
    expect(existing.zaloUid).toBe('zalo-uid-1');
    expect(result.user.id).toBe(existing.id.getValue());
  });

  it('ném ConflictException khi SĐT trùng nhưng zaloUid đã gắn với người khác', async () => {
    const existing = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.ACTIVE,
      loyaltyPoints: 0,
      zaloUid: 'some-other-uid',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    customerRepo.findByZaloUid.mockResolvedValueOnce(null);
    customerRepo.findByPhone.mockResolvedValueOnce(existing);

    await expect(handler.execute(command)).rejects.toThrow(ConflictException);
    expect(customerRepo.save).not.toHaveBeenCalled();
  });

  it('tạo customer mới khi chưa từng tồn tại', async () => {
    customerRepo.findByZaloUid.mockResolvedValueOnce(null);
    customerRepo.findByPhone.mockResolvedValueOnce(null);

    const result = await handler.execute(command);

    expect(customerRepo.save).toHaveBeenCalledTimes(1);
    const savedCustomer = customerRepo.save.mock.calls[0][0];
    expect(savedCustomer.zaloUid).toBe('zalo-uid-1');
    expect(savedCustomer.phone.getValue()).toBe('+84912345678');
    expect(result.scope).toBe('CUSTOMER');
  });

  it('ném ForbiddenException khi customer đã BLOCKED', async () => {
    const blocked = Customer.reconstitute({
      id: new CustomerId(),
      merchantId: 'merchant-1',
      phone: new PhoneNumber('0912345678'),
      fullName: 'Nguyễn Văn A',
      status: CustomerStatus.BLOCKED,
      loyaltyPoints: 0,
      zaloUid: 'zalo-uid-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    customerRepo.findByZaloUid.mockResolvedValueOnce(blocked);

    await expect(handler.execute(command)).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.spec.ts`
Expected: FAIL — `Cannot find module './zalo-miniapp-login.handler'`

- [ ] **Step 3: Implement the handler**

Create `src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.ts`:

```ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  Inject,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZaloMiniAppLoginCommand } from './zalo-miniapp-login.command';
import { ResolveZaloMiniAppConnectionService } from '@/modules/integrations/application/services/resolve-zalo-miniapp-connection.service';
import { ZaloMiniAppGateway } from '@/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '@/modules/customers/domain/repositories/customer.repository.interface';
import { Customer, CustomerStatus } from '@/modules/customers/domain/models/customer.model';
import { PhoneNumber } from '@/modules/customers/domain/value-objects/phone.vo';
import {
  MerchantOrmEntity,
  MerchantStatus,
} from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import {
  TOKEN_GENERATOR_PORT,
  type ITokenGeneratorPort,
} from '@/modules/auth/application/ports/token-generator.port';
import type { UnifiedLoginResult } from '../unified-login/unified-login.handler';

@CommandHandler(ZaloMiniAppLoginCommand)
export class ZaloMiniAppLoginHandler
  implements ICommandHandler<ZaloMiniAppLoginCommand, UnifiedLoginResult>
{
  constructor(
    private readonly resolveConnection: ResolveZaloMiniAppConnectionService,
    private readonly zaloGateway: ZaloMiniAppGateway,
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    @InjectRepository(MerchantOrmEntity)
    private readonly merchantRepository: Repository<MerchantOrmEntity>,
    @Inject(TOKEN_GENERATOR_PORT)
    private readonly tokenGenerator: ITokenGeneratorPort,
  ) {}

  async execute(command: ZaloMiniAppLoginCommand): Promise<UnifiedLoginResult> {
    const { zaloMiniAppId, uid, accessToken, phoneToken } = command;

    const { merchantId, zaloAppSecret } =
      await this.resolveConnection.resolveByMiniAppId(zaloMiniAppId);

    const merchant = await this.merchantRepository.findOne({
      where: { uuid: merchantId },
    });
    if (!merchant || merchant.status !== MerchantStatus.ACTIVE) {
      throw new ForbiddenException('Merchant hiện không hoạt động.');
    }

    const profile = await this.zaloGateway.getProfile(accessToken);
    if (profile.uid !== uid) {
      throw new UnauthorizedException('Thông tin xác thực Zalo không hợp lệ.');
    }
    const realUid = profile.uid;

    const rawPhone = await this.zaloGateway.getPhoneNumber(
      accessToken,
      phoneToken,
      zaloAppSecret,
    );
    const phone = new PhoneNumber(rawPhone);

    let customer = await this.customerRepository.findByZaloUid(merchantId, realUid);

    if (!customer) {
      const byPhone = await this.customerRepository.findByPhone(merchantId, phone);
      if (byPhone) {
        if (byPhone.zaloUid && byPhone.zaloUid !== realUid) {
          throw new ConflictException(
            'Số điện thoại này đã được liên kết với một tài khoản Zalo khác.',
          );
        }
        byPhone.linkZaloAccount(realUid);
        await this.customerRepository.save(byPhone);
        customer = byPhone;
      } else {
        const created = Customer.create({
          merchantId,
          phone,
          fullName: profile.name || phone.getValue(),
          zaloUid: realUid,
        });
        await this.customerRepository.save(created);
        customer = created;
      }
    }

    if (customer.status === CustomerStatus.BLOCKED) {
      throw new ForbiddenException('Tài khoản đã bị khoá.');
    }

    const tokens = await this.tokenGenerator.generateTokens({
      sub: customer.id.getValue(),
      phoneOrEmail: customer.phone?.getValue(),
      scope: 'CUSTOMER',
      merchantId,
    });

    return {
      scope: 'CUSTOMER',
      tokens,
      user: {
        id: customer.id.getValue(),
        email: customer.email?.getValue(),
        phone: customer.phone?.getValue(),
        fullName: customer.fullName,
        role: 'CUSTOMER',
      },
      merchant: {
        id: merchant.uuid,
        code: merchant.code,
        name: merchant.name,
        status: merchant.status,
      },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.ts \
        src/modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.spec.ts
git commit -m "feat(auth): implement ZaloMiniAppLoginHandler"
```

---

### Task 9: Wire `AuthModule`

**Files:**
- Modify: `src/modules/auth/auth.module.ts`

**Interfaces:**
- Consumes: `IntegrationsModule` exports (`ZaloMiniAppGateway`, `ResolveZaloMiniAppConnectionService`) from Task 6, `ZaloMiniAppLoginHandler` from Task 8.
- Produces: `ZaloMiniAppLoginHandler` registered as a CQRS command handler, available to `AuthController` (Task 10).

- [ ] **Step 1: Import `IntegrationsModule` and register the handler**

In `src/modules/auth/auth.module.ts`:
- Add `import { IntegrationsModule } from '../integrations/integrations.module';`
- Add `import { ZaloMiniAppLoginHandler } from './application/commands/zalo-miniapp-login/zalo-miniapp-login.handler';`
- Add `IntegrationsModule` to the `imports` array (alongside `CustomersModule`).
- Add `ZaloMiniAppLoginHandler` to the `providers` array (alongside `UnifiedLoginHandler`, `RefreshTokenHandler`).

- [ ] **Step 2: Verify the app still boots**

Run: `bun run build`
Expected: No TypeScript/module-resolution errors (in particular, no circular-dependency error between `AuthModule` and `IntegrationsModule` — `IntegrationsModule` does not import `AuthModule`, so this is safe).

- [ ] **Step 3: Commit**

```bash
git add src/modules/auth/auth.module.ts
git commit -m "feat(auth): wire ZaloMiniAppLoginHandler and IntegrationsModule into AuthModule"
```

---

### Task 10: `AuthController` route + DRY cookie helper

**Files:**
- Modify: `src/modules/auth/presentation/http/auth.controller.ts`

**Interfaces:**
- Consumes: `ZaloMiniAppLoginDto` (Task 7), `ZaloMiniAppLoginCommand` (Task 7), `CommandBus` (existing), `UnifiedLoginResult` (existing).
- Produces: `POST /v1/auth/zalo-miniapp/login` — response body `{ scope, user, merchant? }`, sets `CUSTOMER_ACCESS`/`CUSTOMER_REFRESH` cookies exactly like `POST /v1/auth/login` does for `CUSTOMER` scope.

- [ ] **Step 1: Extract the existing cookie-setting + response-shaping logic into a private helper**

In `src/modules/auth/presentation/http/auth.controller.ts`, add this private method to `AuthController` (this is a pure refactor of the existing `login()` body — no behavior change):

```ts
  private respondWithAuthResult(
    result: UnifiedLoginResult,
    res: Response,
  ) {
    const cookieKeys = SCOPE_COOKIE_KEYS[result.scope];
    CookieUtil.setAuthCookies(
      res,
      cookieKeys.access,
      cookieKeys.refresh,
      result.tokens.accessToken,
      result.tokens.refreshToken ?? '',
    );

    return {
      scope: result.scope,
      user: result.user,
      ...(result.merchant && { merchant: result.merchant }),
    };
  }
```

Then replace the body of `login()` (everything after `commandBus.execute(...)`) with `return this.respondWithAuthResult(result, res);`, and do the same in `refresh()`'s cookie-setting block where it applies.

- [ ] **Step 2: Add the new route**

In the same file, add imports:

```ts
import { ZaloMiniAppLoginDto } from '../../application/dtos/zalo-miniapp-login.dto';
import { ZaloMiniAppLoginCommand } from '../../application/commands/zalo-miniapp-login/zalo-miniapp-login.command';
```

Add the route method inside `AuthController` (after `login()`):

```ts
  @Post('zalo-miniapp/login')
  @HttpCode(HttpStatus.OK)
  async zaloMiniAppLogin(
    @Body() dto: ZaloMiniAppLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.commandBus.execute<
      ZaloMiniAppLoginCommand,
      UnifiedLoginResult
    >(
      new ZaloMiniAppLoginCommand(
        dto.zaloMiniAppId,
        dto.uid,
        dto.accessToken,
        dto.phoneToken,
      ),
    );

    return this.respondWithAuthResult(result, res);
  }
```

- [ ] **Step 3: Run the full auth module test suite**

Run: `bun run test -- src/modules/auth`
Expected: PASS — no regressions in existing `unified-login`/`refresh-token` handler tests, and the new handler test from Task 8 still passes.

- [ ] **Step 4: Commit**

```bash
git add src/modules/auth/presentation/http/auth.controller.ts
git commit -m "feat(auth): add POST /v1/auth/zalo-miniapp/login route"
```

---

### Task 11: End-to-end test for the full login flow

**Files:**
- Create: `test/zalo-miniapp-login.e2e-spec.ts`

**Interfaces:**
- Consumes: the full running Nest app (via `Test.createTestingModule({ imports: [AppModule] })`), with `ZaloMiniAppGateway` overridden via `overrideProvider` so no real Zalo network calls happen. Consumes `ResolveZaloMiniAppConnectionService`/`INTEGRATION_CONNECTION_REPOSITORY` and `CUSTOMER_REPOSITORY`/`MerchantOrmEntity` repositories directly to seed fixtures.
- Produces: no new interfaces — this is the final verification that all prior tasks wire together correctly through real HTTP + real DB.

- [ ] **Step 1: Write the e2e test**

Create `test/zalo-miniapp-login.e2e-spec.ts` (follow the existing `test/app.e2e-spec.ts` bootstrap pattern — read that file first for the exact `Test.createTestingModule` / `app.init()` boilerplate used in this repo, then adapt it):

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppModule } from '../src/app.module';
import { ZaloMiniAppGateway } from '../src/modules/integrations/infrastructure/gateways/zalo-miniapp.gateway';
import { IntegrationConnectionOrmEntity } from '../src/modules/integrations/infrastructure/persistence/entities/integration-connection.orm-entity';
import { IntegrationProviderEnum } from '../src/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationStatusEnum } from '../src/modules/integrations/domain/value-objects/integration-status.vo';
import { MerchantOrmEntity } from '../src/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { CustomerOrmEntity } from '../src/modules/customers/infrastructure/persistence/entities/customer.orm-entity';

describe('POST /v1/auth/zalo-miniapp/login (e2e)', () => {
  let app: INestApplication;
  let merchantId: string;
  const zaloMiniAppId = 'e2e-mini-app-1';

  const mockGateway = {
    getProfile: jest.fn(),
    getPhoneNumber: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ZaloMiniAppGateway)
      .useValue(mockGateway)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    const merchantRepo = moduleRef.get(getRepositoryToken(MerchantOrmEntity));
    const merchant = await merchantRepo.save(
      merchantRepo.create({ code: 'E2E-MINIAPP', name: 'E2E Merchant' }),
    );
    merchantId = merchant.uuid;

    const connectionRepo = moduleRef.get(
      getRepositoryToken(IntegrationConnectionOrmEntity),
    );
    await connectionRepo.save(
      connectionRepo.create({
        merchantId,
        provider: IntegrationProviderEnum.ZALO_MINI_APP,
        externalId: zaloMiniAppId,
        status: IntegrationStatusEnum.ACTIVE,
        metadata: { zaloAppId: 'app-e2e', zaloAppSecret: 'secret-e2e' },
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('tạo customer mới và set cookie khi lần đầu đăng nhập', async () => {
    mockGateway.getProfile.mockResolvedValueOnce({ uid: 'e2e-uid-1', name: 'Khách E2E' });
    mockGateway.getPhoneNumber.mockResolvedValueOnce('84911111111');

    const response = await request(app.getHttpServer())
      .post('/v1/auth/zalo-miniapp/login')
      .send({
        zaloMiniAppId,
        uid: 'e2e-uid-1',
        accessToken: 'acc-1',
        phoneToken: 'phone-1',
      })
      .expect(200);

    expect(response.body.scope).toBe('CUSTOMER');
    expect(response.body.user.phone).toBe('+84911111111');
    expect(response.headers['set-cookie'].some((c: string) => c.startsWith('cus_access_token='))).toBe(true);
  });

  it('đăng nhập lại trả về cùng customer (không tạo bản ghi mới)', async () => {
    mockGateway.getProfile.mockResolvedValueOnce({ uid: 'e2e-uid-1', name: 'Khách E2E' });
    mockGateway.getPhoneNumber.mockResolvedValueOnce('84911111111');

    const response = await request(app.getHttpServer())
      .post('/v1/auth/zalo-miniapp/login')
      .send({
        zaloMiniAppId,
        uid: 'e2e-uid-1',
        accessToken: 'acc-2',
        phoneToken: 'phone-2',
      })
      .expect(200);

    const customerRepo = (app as any).get(getRepositoryToken(CustomerOrmEntity));
    const count = await customerRepo.count({ where: { merchantId, zaloUid: 'e2e-uid-1' } });
    expect(count).toBe(1);
    expect(response.body.user.phone).toBe('+84911111111');
  });

  it('trả 401 khi uid không khớp với Zalo thật', async () => {
    mockGateway.getProfile.mockResolvedValueOnce({ uid: 'real-uid', name: 'X' });

    await request(app.getHttpServer())
      .post('/v1/auth/zalo-miniapp/login')
      .send({
        zaloMiniAppId,
        uid: 'claimed-uid',
        accessToken: 'acc-3',
        phoneToken: 'phone-3',
      })
      .expect(401);
  });

  it('trả 404 khi zaloMiniAppId không tồn tại', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/zalo-miniapp/login')
      .send({
        zaloMiniAppId: 'unknown-mini-app',
        uid: 'x',
        accessToken: 'acc-4',
        phoneToken: 'phone-4',
      })
      .expect(404);
  });
});
```

- [ ] **Step 2: Run the e2e test to verify it fails first (route not yet wired, or fixtures wrong)**

Run: `bun run test:e2e -- zalo-miniapp-login.e2e-spec.ts`
Expected: If Tasks 1–10 are already done, this should mostly PASS on the first try (it's a verification task, not a TDD-driven implementation task) — if it fails, read the failure carefully: it's almost certainly a fixture/mocking mismatch (e.g. `getRepositoryToken` import path, or `AppModule` bootstrap requiring extra env vars — check `test/app.e2e-spec.ts` for how existing e2e tests set up required env vars like `JWT_CUSTOMER_SECRET`, `DB_*`, `ZALO_OA_*`).

- [ ] **Step 3: Fix any fixture/env issues and re-run until green**

Run: `bun run test:e2e -- zalo-miniapp-login.e2e-spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 4: Run the entire test suite one last time**

Run: `bun run test && bun run test:e2e`
Expected: All PASS, no regressions anywhere in the repo.

- [ ] **Step 5: Commit**

```bash
git add test/zalo-miniapp-login.e2e-spec.ts
git commit -m "test(auth): add e2e coverage for Zalo Mini App login"
```

---

## Self-Review Notes

- **Spec coverage:** all sections of the design spec are covered — 3-identifier resolution (Task 5), uid cross-check (Task 8), auto-link/JIT-provision/conflict (Task 8), unique index (Task 2), enum + mock-mode (Task 3), gateway (Task 4), DRY cookie reuse (Task 10), full e2e (Task 11). The one explicitly out-of-scope item from the spec (customer-facing website, `UnifiedLoginHandler.status` check) is intentionally not a task here.
- **Encryption note:** the spec's original prose said "mã hoá at-rest" for `zaloAppSecret` — corrected in this plan's Global Constraints after inspecting the actual codebase: `ZALO_OA` tokens are stored in plain `jsonb`/`text` columns today with no encryption transformer, so `zaloAppSecret` follows the same (existing, not-yet-encrypted) convention rather than introducing new crypto machinery unilaterally.
- **Exception convention correction:** the spec's edge-case table said Zalo API failures (invalid `accessToken`/`phoneToken`) map to `UnauthorizedException`; after reading `ZaloOaGateway`, the established convention in this codebase is `BadGatewayException` for any rejected/failed upstream Zalo call. This plan follows the existing convention. `UnauthorizedException` is reserved for the uid-mismatch check, which is a local trust decision, not a Zalo API response.
