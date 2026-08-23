# Zalo OA Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build module `integrations` (NestJS) cho phép merchant liên kết Zalo OA qua OAuth2, xem trạng thái liên kết, đồng bộ tin nhắn đến qua webhook, và gửi tin nhắn OA — theo abstraction dùng chung (`IMessagingGateway`/`IOAuthConnectable`) để vendor khác (eSMS) cắm vào sau này.

**Architecture:** DDD/CQRS theo layout `domain/application/infrastructure/presentation` đã dùng trong `payment` module (handler class thuần, gọi trực tiếp qua `.execute()`, không qua `CommandBus`). `ZaloOaGateway` implement 2 interface dùng chung, đăng ký trong `IntegrationGatewayFactory` (giống `PaymentGatewayFactory`). Token OAuth lưu trong bảng `integration_connections`; tin nhắn đồng bộ lưu `zalo_oa_messages`. `synchronize: true` đang bật nên không cần viết migration thủ công.

**Tech Stack:** NestJS 11, TypeORM (Postgres), class-validator, axios, @nestjs/jwt (ký state token), Jest + ts-jest.

**Spec:** `docs/superpowers/specs/2026-08-23-zalo-oa-integration-design.md`

## Global Constraints

- Route prefix: global `api` + version `1` (khai báo `@Controller({ path: '...', version: '1' })`) — response cuối là `/api/v1/...`.
- Guard merchant: `MerchantAuthGuard` (`src/shared/infrastructure/auth/guards/auth-guards.guards.ts`), `req.user.merchantId` có sẵn từ `MerchantJwtStrategy`.
- Entity ORM kế thừa `BaseOrmEntity` (`id` bigint PK nội bộ, `uuid` là business key public).
- Domain aggregate/entity kế thừa `BaseEntity<string>` (id = uuid), theo style `PaymentOrder` (`src/modules/payment/domain/models/payment-order.aggregate.ts`), KHÔNG dùng CQRS `CommandBus`/`QueryBus` — handler là class `Injectable` thuần với method `execute()`.
- Secret bắt buộc đọc qua `ConfigService.getOrThrow`; secret optional qua `ConfigService.get(..., default)`.
- Lỗi gọi API ngoài log bằng `Logger` (Nest), không dùng `console.log`.
- Không viết migration thủ công (synchronize=true ở dev). Không mã hoá token tại rest (ngoài phạm vi, xem spec §2).
- Test: `jest`, rootDir `src`, file `*.spec.ts` cạnh file nguồn. Alias `@/` phải resolve được trong Jest (Task 1 sửa việc này).

---

### Task 1: Sửa Jest alias resolution (`@/`)

Hiện `package.json` → `jest` không có `moduleNameMapper`, nên mọi file nguồn dùng
`import ... from '@/...'` (32 file trong repo) sẽ **fail resolve** khi chạy dưới Jest
— toàn bộ test viết trong plan này phụ thuộc vào việc alias resolve được. Đây là
prerequisite phải sửa trước.

**Files:**
- Modify: `package.json` (khối `"jest"`)
- Test: `src/__alias-check.spec.ts` (file tạm, xoá sau khi xác nhận, không commit)

**Interfaces:** Không có (thay đổi tooling).

- [ ] **Step 1: Viết file test tạm để xác nhận lỗi**

```ts
// src/__alias-check.spec.ts
import { COOKIE_KEYS } from '@/shared/infrastructure/utils/cookie.util';

test('alias @/ resolves', () => {
  expect(COOKIE_KEYS).toBeDefined();
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/__alias-check.spec.ts`
Expected: FAIL với `Cannot find module '@/shared/infrastructure/utils/cookie.util'`

- [ ] **Step 3: Thêm `moduleNameMapper` vào `package.json`**

Trong `package.json`, khối `"jest"`, thêm key `moduleNameMapper` (giữ nguyên các key khác):

```json
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "moduleNameMapper": {
    "^@/(.*)$": "<rootDir>/$1"
  },
  "testRegex": ".*\\.spec\\.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "collectCoverageFrom": ["**/*.(t|j)s"],
  "coverageDirectory": "../coverage",
  "testEnvironment": "node"
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx jest src/__alias-check.spec.ts`
Expected: PASS

- [ ] **Step 5: Xoá file test tạm**

```bash
rm src/__alias-check.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "fix(test): map @/ alias for jest module resolution"
```

---

### Task 2: Env config + domain enums

**Files:**
- Modify: `src/infrastructure/configs/env.validation.ts`
- Create: `src/modules/integrations/domain/value-objects/integration-provider.vo.ts`
- Create: `src/modules/integrations/domain/value-objects/integration-status.vo.ts`
- Test: `src/infrastructure/configs/env.validation.spec.ts`

**Interfaces:**
- Produces: `IntegrationProviderEnum { ZALO_OA, ESMS }`, `IntegrationStatusEnum { ACTIVE, EXPIRED, REVOKED }`, `validateEnv()` yêu cầu thêm 4 biến `ZALO_OA_*`.

- [ ] **Step 1: Viết test cho env validation (thêm biến bắt buộc)**

```ts
// src/infrastructure/configs/env.validation.spec.ts
import { validateEnv } from './env.validation';

const baseValidConfig = {
  JWT_SYSTEM_SECRET: 'a',
  JWT_MERCHANT_SECRET: 'a',
  JWT_CUSTOMER_SECRET: 'a',
  DB_HOST: 'localhost',
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'db',
  REDIS_HOST: 'localhost',
  RABBITMQ_URI: 'amqp://localhost',
  KAFKA_BROKERS: 'localhost:9092',
  MOMO_ACCESS_KEY: 'a',
  MOMO_SECRET_KEY: 'a',
  MOMO_API_ENDPOINT: 'https://example.com',
  ZALO_OA_APP_ID: 'app-id',
  ZALO_OA_SECRET_KEY: 'secret',
  ZALO_OA_REDIRECT_URI: 'https://api.example.com/api/v1/integrations/zalo-oa/callback',
  ZALO_OA_STATE_SECRET: 'state-secret',
};

describe('env.validation — Zalo OA', () => {
  it('parses successfully when all ZALO_OA_* vars are present', () => {
    const result = validateEnv(baseValidConfig);
    expect(result.ZALO_OA_APP_ID).toBe('app-id');
    expect(result.ZALO_OA_REDIRECT_URI).toBe(
      'https://api.example.com/api/v1/integrations/zalo-oa/callback',
    );
  });

  it('throws when ZALO_OA_APP_ID is missing', () => {
    const { ZALO_OA_APP_ID, ...rest } = baseValidConfig;
    expect(() => validateEnv(rest)).toThrow(/Config validation error/);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/infrastructure/configs/env.validation.spec.ts`
Expected: FAIL (`ZALO_OA_APP_ID` không tồn tại trong type/schema hiện tại → field bị bỏ qua, test đầu tiên assert `toBe('app-id')` fail vì `undefined`)

- [ ] **Step 3: Thêm biến vào schema**

Trong `src/infrastructure/configs/env.validation.ts`, thêm khối sau vào `envSchema`
(sau khối `// MoMo`):

```ts
  // Zalo OA
  ZALO_OA_APP_ID: z.string().min(1),
  ZALO_OA_SECRET_KEY: z.string().min(1),
  ZALO_OA_REDIRECT_URI: z.string().min(1),
  ZALO_OA_STATE_SECRET: z.string().min(1),
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx jest src/infrastructure/configs/env.validation.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 5: Tạo enum provider**

```ts
// src/modules/integrations/domain/value-objects/integration-provider.vo.ts
export enum IntegrationProviderEnum {
  ZALO_OA = 'ZALO_OA',
  ESMS = 'ESMS',
}
```

- [ ] **Step 6: Tạo enum status**

```ts
// src/modules/integrations/domain/value-objects/integration-status.vo.ts
export enum IntegrationStatusEnum {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}
```

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/configs/env.validation.ts src/infrastructure/configs/env.validation.spec.ts src/modules/integrations/domain/value-objects
git commit -m "feat(integrations): add Zalo OA env config and provider/status enums"
```

---

### Task 3: `IntegrationConnection` aggregate + repository interface

**Files:**
- Create: `src/modules/integrations/domain/models/integration-connection.aggregate.ts`
- Create: `src/modules/integrations/domain/repositories/integration-connection.repository.interface.ts`
- Test: `src/modules/integrations/domain/models/integration-connection.aggregate.spec.ts`

**Interfaces:**
- Consumes: `IntegrationProviderEnum`, `IntegrationStatusEnum` (Task 2), `BaseEntity<string>` (`src/shared/domain/base.entity.ts`, đã có sẵn).
- Produces:
  - `class IntegrationConnection extends BaseEntity<string>` với method:
    `static create(merchantId: string, provider: IntegrationProviderEnum, externalId: string, tokens: IntegrationTokenSet, metadata?: Record<string, any>): IntegrationConnection`
    `updateTokens(tokens: IntegrationTokenSet): void`
    `markExpired(): void`
    `isTokenExpiringSoon(withinMs?: number): boolean`
    getters: `getUuid()`, `getMerchantId()`, `getProvider()`, `getExternalId()`,
    `getStatus()`, `getAccessToken()`, `getRefreshToken()`, `getTokenExpiresAt()`,
    `getMetadata()`
  - `interface IntegrationTokenSet { accessToken: string; refreshToken: string; expiresAt: Date }`
  - `interface IIntegrationConnectionRepository { findByMerchantAndProvider(merchantId: string, provider: IntegrationProviderEnum): Promise<IntegrationConnection | null>; findByExternalId(provider: IntegrationProviderEnum, externalId: string): Promise<IntegrationConnection | null>; findById(uuid: string): Promise<IntegrationConnection | null>; save(connection: IntegrationConnection): Promise<void>; }`
  - `const INTEGRATION_CONNECTION_REPOSITORY = Symbol('IIntegrationConnectionRepository')`

- [ ] **Step 1: Viết test cho aggregate**

```ts
// src/modules/integrations/domain/models/integration-connection.aggregate.spec.ts
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/domain/models/integration-connection.aggregate.spec.ts`
Expected: FAIL (`Cannot find module './integration-connection.aggregate'`)

- [ ] **Step 3: Implement aggregate**

```ts
// src/modules/integrations/domain/models/integration-connection.aggregate.ts
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
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/domain/models/integration-connection.aggregate.spec.ts`
Expected: PASS (4 test)

- [ ] **Step 5: Tạo repository interface**

```ts
// src/modules/integrations/domain/repositories/integration-connection.repository.interface.ts
import type { IntegrationConnection } from '../models/integration-connection.aggregate';
import type { IntegrationProviderEnum } from '../value-objects/integration-provider.vo';

export interface IIntegrationConnectionRepository {
  findByMerchantAndProvider(
    merchantId: string,
    provider: IntegrationProviderEnum,
  ): Promise<IntegrationConnection | null>;
  findByExternalId(
    provider: IntegrationProviderEnum,
    externalId: string,
  ): Promise<IntegrationConnection | null>;
  findById(uuid: string): Promise<IntegrationConnection | null>;
  save(connection: IntegrationConnection): Promise<void>;
}

export const INTEGRATION_CONNECTION_REPOSITORY = Symbol(
  'IIntegrationConnectionRepository',
);
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/domain/models/integration-connection.aggregate.ts src/modules/integrations/domain/models/integration-connection.aggregate.spec.ts src/modules/integrations/domain/repositories/integration-connection.repository.interface.ts
git commit -m "feat(integrations): add IntegrationConnection aggregate and repository port"
```

---

### Task 4: `ZaloOaMessage` entity + repository interface

**Files:**
- Create: `src/modules/integrations/domain/models/zalo-oa-message.entity.ts`
- Create: `src/modules/integrations/domain/repositories/zalo-oa-message.repository.interface.ts`
- Test: `src/modules/integrations/domain/models/zalo-oa-message.entity.spec.ts`

**Interfaces:**
- Consumes: `BaseEntity<string>`.
- Produces:
  - `enum ZaloOaMessageDirectionEnum { IN, OUT }`
  - `class ZaloOaMessage extends BaseEntity<string>` với `static create(params): ZaloOaMessage`
    và getters: `getUuid()`, `getConnectionId()`, `getDirection()`, `getZaloUserId()`,
    `getContent()`, `getMessageType()`, `getExternalMessageId()`, `getSentAt()`
  - `interface IZaloOaMessageRepository { save(message): Promise<void>; existsByExternalMessageId(connectionId: string, externalMessageId: string): Promise<boolean>; findByConnection(connectionId: string, params: { cursor?: string; limit?: number }): Promise<{ items: ZaloOaMessage[]; hasNextPage: boolean; nextCursor: string | null }>; }`
  - `const ZALO_OA_MESSAGE_REPOSITORY = Symbol('IZaloOaMessageRepository')`

- [ ] **Step 1: Viết test cho entity**

```ts
// src/modules/integrations/domain/models/zalo-oa-message.entity.spec.ts
import {
  ZaloOaMessage,
  ZaloOaMessageDirectionEnum,
} from './zalo-oa-message.entity';

describe('ZaloOaMessage', () => {
  it('create() khởi tạo đầy đủ field và sinh uuid', () => {
    const sentAt = new Date('2026-08-23T10:00:00Z');
    const msg = ZaloOaMessage.create({
      connectionId: 'conn-1',
      direction: ZaloOaMessageDirectionEnum.IN,
      zaloUserId: 'zalo-user-1',
      content: 'Xin chào',
      messageType: 'text',
      externalMessageId: 'msg-abc',
      sentAt,
    });

    expect(msg.getConnectionId()).toBe('conn-1');
    expect(msg.getDirection()).toBe(ZaloOaMessageDirectionEnum.IN);
    expect(msg.getZaloUserId()).toBe('zalo-user-1');
    expect(msg.getContent()).toBe('Xin chào');
    expect(msg.getMessageType()).toBe('text');
    expect(msg.getExternalMessageId()).toBe('msg-abc');
    expect(msg.getSentAt()).toEqual(sentAt);
    expect(msg.getUuid()).toEqual(expect.any(String));
  });

  it('create() cho phép externalMessageId undefined (tin OUT tự gửi, chưa có id trả về)', () => {
    const msg = ZaloOaMessage.create({
      connectionId: 'conn-1',
      direction: ZaloOaMessageDirectionEnum.OUT,
      zaloUserId: 'zalo-user-1',
      content: 'Cảm ơn bạn',
      messageType: 'text',
      sentAt: new Date(),
    });

    expect(msg.getExternalMessageId()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/domain/models/zalo-oa-message.entity.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement entity**

```ts
// src/modules/integrations/domain/models/zalo-oa-message.entity.ts
import { BaseEntity } from '@/shared/domain/base.entity';

export enum ZaloOaMessageDirectionEnum {
  IN = 'IN',
  OUT = 'OUT',
}

export interface CreateZaloOaMessageParams {
  connectionId: string;
  direction: ZaloOaMessageDirectionEnum;
  zaloUserId: string;
  content: string;
  messageType: string;
  externalMessageId?: string;
  sentAt: Date;
}

export class ZaloOaMessage extends BaseEntity<string> {
  constructor(
    uuid: string,
    private readonly connectionId: string,
    private readonly direction: ZaloOaMessageDirectionEnum,
    private readonly zaloUserId: string,
    private readonly content: string,
    private readonly messageType: string,
    private readonly externalMessageId: string | undefined,
    private readonly sentAt: Date,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(uuid, createdAt, updatedAt);
  }

  static create(params: CreateZaloOaMessageParams): ZaloOaMessage {
    return new ZaloOaMessage(
      crypto.randomUUID(),
      params.connectionId,
      params.direction,
      params.zaloUserId,
      params.content,
      params.messageType,
      params.externalMessageId,
      params.sentAt,
    );
  }

  getUuid(): string {
    return this.id;
  }
  getConnectionId(): string {
    return this.connectionId;
  }
  getDirection(): ZaloOaMessageDirectionEnum {
    return this.direction;
  }
  getZaloUserId(): string {
    return this.zaloUserId;
  }
  getContent(): string {
    return this.content;
  }
  getMessageType(): string {
    return this.messageType;
  }
  getExternalMessageId(): string | undefined {
    return this.externalMessageId;
  }
  getSentAt(): Date {
    return this.sentAt;
  }
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/domain/models/zalo-oa-message.entity.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 5: Tạo repository interface**

```ts
// src/modules/integrations/domain/repositories/zalo-oa-message.repository.interface.ts
import type { ZaloOaMessage } from '../models/zalo-oa-message.entity';

export interface ZaloOaMessagePage {
  items: ZaloOaMessage[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface IZaloOaMessageRepository {
  save(message: ZaloOaMessage): Promise<void>;
  existsByExternalMessageId(
    connectionId: string,
    externalMessageId: string,
  ): Promise<boolean>;
  findByConnection(
    connectionId: string,
    params: { cursor?: string; limit?: number },
  ): Promise<ZaloOaMessagePage>;
}

export const ZALO_OA_MESSAGE_REPOSITORY = Symbol('IZaloOaMessageRepository');
```

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/domain/models/zalo-oa-message.entity.ts src/modules/integrations/domain/models/zalo-oa-message.entity.spec.ts src/modules/integrations/domain/repositories/zalo-oa-message.repository.interface.ts
git commit -m "feat(integrations): add ZaloOaMessage entity and repository port"
```

---

### Task 5: ORM entities + mapper cho `IntegrationConnection`

**Files:**
- Create: `src/modules/integrations/infrastructure/persistence/entities/integration-connection.orm-entity.ts`
- Create: `src/modules/integrations/infrastructure/persistence/mappers/integration-connection.mapper.ts`
- Test: `src/modules/integrations/infrastructure/persistence/mappers/integration-connection.mapper.spec.ts`

**Interfaces:**
- Consumes: `IntegrationConnection`, `IntegrationTokenSet` (Task 3); `IntegrationProviderEnum`,
  `IntegrationStatusEnum` (Task 2); `BaseOrmEntity`, `MerchantOrmEntity` (đã có sẵn trong repo).
- Produces:
  - `class IntegrationConnectionOrmEntity extends BaseOrmEntity` (bảng `integration_connections`)
  - `class IntegrationConnectionMapper { static toDomain(orm): IntegrationConnection; static toOrm(domain): IntegrationConnectionOrmEntity }`

- [ ] **Step 1: Viết test cho mapper (round-trip)**

```ts
// src/modules/integrations/infrastructure/persistence/mappers/integration-connection.mapper.spec.ts
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/infrastructure/persistence/mappers/integration-connection.mapper.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Tạo ORM entity**

```ts
// src/modules/integrations/infrastructure/persistence/entities/integration-connection.orm-entity.ts
import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationStatusEnum } from '@/modules/integrations/domain/value-objects/integration-status.vo';

@Entity({ name: 'integration_connections' })
@Index(['merchantId', 'provider'], { unique: true })
export class IntegrationConnectionOrmEntity extends BaseOrmEntity {
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  merchant?: MerchantOrmEntity;

  @Column({ type: 'enum', enum: IntegrationProviderEnum })
  provider: IntegrationProviderEnum;

  @Column({ name: 'external_id', type: 'varchar', length: 100 })
  externalId: string;

  @Column({
    type: 'enum',
    enum: IntegrationStatusEnum,
    default: IntegrationStatusEnum.ACTIVE,
  })
  status: IntegrationStatusEnum;

  @Column({ name: 'access_token', type: 'text', nullable: true })
  accessToken: string | null;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken: string | null;

  @Column({ name: 'token_expires_at', type: 'timestamptz', nullable: true })
  tokenExpiresAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;
}
```

- [ ] **Step 4: Tạo mapper**

```ts
// src/modules/integrations/infrastructure/persistence/mappers/integration-connection.mapper.ts
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationConnectionOrmEntity } from '../entities/integration-connection.orm-entity';

export class IntegrationConnectionMapper {
  static toDomain(orm: IntegrationConnectionOrmEntity): IntegrationConnection {
    return new IntegrationConnection(
      orm.uuid,
      orm.merchantId,
      orm.provider,
      orm.externalId,
      orm.status,
      orm.accessToken ?? undefined,
      orm.refreshToken ?? undefined,
      orm.tokenExpiresAt ?? undefined,
      orm.metadata ?? undefined,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(
    domain: IntegrationConnection,
  ): IntegrationConnectionOrmEntity {
    const orm = new IntegrationConnectionOrmEntity();
    orm.uuid = domain.getUuid();
    orm.merchantId = domain.getMerchantId();
    orm.provider = domain.getProvider();
    orm.externalId = domain.getExternalId();
    orm.status = domain.getStatus();
    orm.accessToken = domain.getAccessToken() ?? null;
    orm.refreshToken = domain.getRefreshToken() ?? null;
    orm.tokenExpiresAt = domain.getTokenExpiresAt() ?? null;
    orm.metadata = domain.getMetadata() ?? null;
    return orm;
  }
}
```

Constructor của `IntegrationConnection` là public (theo đúng style `PaymentOrder`
trong `payment` module) nên mapper gọi thẳng, không cần ép kiểu — chỉ có
`create()`/mapper mới nên gọi trực tiếp theo quy ước, giữ đúng `createdAt/updatedAt`
gốc từ DB thay vì sinh mới.

- [ ] **Step 5: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/infrastructure/persistence/mappers/integration-connection.mapper.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/infrastructure/persistence/entities/integration-connection.orm-entity.ts src/modules/integrations/infrastructure/persistence/mappers/integration-connection.mapper.ts src/modules/integrations/infrastructure/persistence/mappers/integration-connection.mapper.spec.ts
git commit -m "feat(integrations): add IntegrationConnection ORM entity and mapper"
```

---

### Task 6: ORM entity + mapper cho `ZaloOaMessage`

**Files:**
- Create: `src/modules/integrations/infrastructure/persistence/entities/zalo-oa-message.orm-entity.ts`
- Create: `src/modules/integrations/infrastructure/persistence/mappers/zalo-oa-message.mapper.ts`
- Test: `src/modules/integrations/infrastructure/persistence/mappers/zalo-oa-message.mapper.spec.ts`

**Interfaces:**
- Consumes: `ZaloOaMessage`, `ZaloOaMessageDirectionEnum` (Task 4); `IntegrationConnectionOrmEntity` (Task 5).
- Produces: `class ZaloOaMessageOrmEntity extends BaseOrmEntity` (bảng `zalo_oa_messages`),
  `class ZaloOaMessageMapper { static toDomain(orm): ZaloOaMessage; static toOrm(domain): ZaloOaMessageOrmEntity }`.

- [ ] **Step 1: Viết test cho mapper**

```ts
// src/modules/integrations/infrastructure/persistence/mappers/zalo-oa-message.mapper.spec.ts
import {
  ZaloOaMessage,
  ZaloOaMessageDirectionEnum,
} from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { ZaloOaMessageMapper } from './zalo-oa-message.mapper';

describe('ZaloOaMessageMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu', () => {
    const sentAt = new Date('2026-08-23T09:00:00Z');
    const domain = ZaloOaMessage.create({
      connectionId: 'conn-1',
      direction: ZaloOaMessageDirectionEnum.IN,
      zaloUserId: 'zalo-user-1',
      content: 'Xin chào',
      messageType: 'text',
      externalMessageId: 'msg-1',
      sentAt,
    });

    const orm = ZaloOaMessageMapper.toOrm(domain);
    orm.id = '10';

    const roundTripped = ZaloOaMessageMapper.toDomain(orm);
    expect(roundTripped.getConnectionId()).toBe('conn-1');
    expect(roundTripped.getDirection()).toBe(ZaloOaMessageDirectionEnum.IN);
    expect(roundTripped.getContent()).toBe('Xin chào');
    expect(roundTripped.getExternalMessageId()).toBe('msg-1');
    expect(roundTripped.getSentAt()).toEqual(sentAt);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/infrastructure/persistence/mappers/zalo-oa-message.mapper.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Tạo ORM entity**

```ts
// src/modules/integrations/infrastructure/persistence/entities/zalo-oa-message.orm-entity.ts
import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { ZaloOaMessageDirectionEnum } from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { IntegrationConnectionOrmEntity } from './integration-connection.orm-entity';

@Entity({ name: 'zalo_oa_messages' })
@Index(['connectionId', 'externalMessageId'])
export class ZaloOaMessageOrmEntity extends BaseOrmEntity {
  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @ManyToOne(() => IntegrationConnectionOrmEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id', referencedColumnName: 'uuid' })
  connection?: IntegrationConnectionOrmEntity;

  @Column({ type: 'enum', enum: ZaloOaMessageDirectionEnum })
  direction: ZaloOaMessageDirectionEnum;

  @Column({ name: 'zalo_user_id', type: 'varchar', length: 100 })
  zaloUserId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'message_type', type: 'varchar', length: 50 })
  messageType: string;

  @Column({ name: 'external_message_id', type: 'varchar', length: 100, nullable: true })
  externalMessageId: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz' })
  sentAt: Date;
}
```

- [ ] **Step 4: Tạo mapper**

```ts
// src/modules/integrations/infrastructure/persistence/mappers/zalo-oa-message.mapper.ts
import {
  ZaloOaMessage,
  ZaloOaMessageDirectionEnum,
} from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { ZaloOaMessageOrmEntity } from '../entities/zalo-oa-message.orm-entity';

export class ZaloOaMessageMapper {
  static toDomain(orm: ZaloOaMessageOrmEntity): ZaloOaMessage {
    return new ZaloOaMessage(
      orm.uuid,
      orm.connectionId,
      orm.direction,
      orm.zaloUserId,
      orm.content,
      orm.messageType,
      orm.externalMessageId ?? undefined,
      orm.sentAt,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: ZaloOaMessage): ZaloOaMessageOrmEntity {
    const orm = new ZaloOaMessageOrmEntity();
    orm.uuid = domain.getUuid();
    orm.connectionId = domain.getConnectionId();
    orm.direction = domain.getDirection() as ZaloOaMessageDirectionEnum;
    orm.zaloUserId = domain.getZaloUserId();
    orm.content = domain.getContent();
    orm.messageType = domain.getMessageType();
    orm.externalMessageId = domain.getExternalMessageId() ?? null;
    orm.sentAt = domain.getSentAt();
    return orm;
  }
}
```

- [ ] **Step 5: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/infrastructure/persistence/mappers/zalo-oa-message.mapper.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/infrastructure/persistence/entities/zalo-oa-message.orm-entity.ts src/modules/integrations/infrastructure/persistence/mappers/zalo-oa-message.mapper.ts src/modules/integrations/infrastructure/persistence/mappers/zalo-oa-message.mapper.spec.ts
git commit -m "feat(integrations): add ZaloOaMessage ORM entity and mapper"
```

---

### Task 7: TypeORM repositories (Connection + Message)

**Files:**
- Create: `src/modules/integrations/infrastructure/persistence/repositories/typeorm-integration-connection.repository.ts`
- Create: `src/modules/integrations/infrastructure/persistence/repositories/typeorm-zalo-oa-message.repository.ts`

**Interfaces:**
- Consumes: `IIntegrationConnectionRepository` (Task 3), `IZaloOaMessageRepository` (Task 4),
  `IntegrationConnectionMapper` (Task 5), `ZaloOaMessageMapper` (Task 6),
  `paginateByUuidCursor` (`src/shared/infrastructure/persistence/cursor-pagination.util.ts`, đã có sẵn).
- Produces: `class TypeOrmIntegrationConnectionRepository implements IIntegrationConnectionRepository`,
  `class TypeOrmZaloOaMessageRepository implements IZaloOaMessageRepository`.

Không viết test cho 2 class này (đi qua DB thật) — nhất quán với
`TypeOrmMerchantRepository`/`PaymentOrderTypeormRepository` trong repo hiện tại,
vốn cũng không có test riêng; được xác minh gián tiếp qua `npm run build` (Task 15)
và kiểm thử thủ công qua Swagger sau khi wiring xong (Task 14).

- [ ] **Step 1: Implement `TypeOrmIntegrationConnectionRepository`**

```ts
// src/modules/integrations/infrastructure/persistence/repositories/typeorm-integration-connection.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IIntegrationConnectionRepository } from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import type { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import type { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { IntegrationConnectionOrmEntity } from '../entities/integration-connection.orm-entity';
import { IntegrationConnectionMapper } from '../mappers/integration-connection.mapper';

@Injectable()
export class TypeOrmIntegrationConnectionRepository
  implements IIntegrationConnectionRepository
{
  constructor(
    @InjectRepository(IntegrationConnectionOrmEntity)
    private readonly repo: Repository<IntegrationConnectionOrmEntity>,
  ) {}

  async findByMerchantAndProvider(
    merchantId: string,
    provider: IntegrationProviderEnum,
  ): Promise<IntegrationConnection | null> {
    const orm = await this.repo.findOne({ where: { merchantId, provider } });
    return orm ? IntegrationConnectionMapper.toDomain(orm) : null;
  }

  async findByExternalId(
    provider: IntegrationProviderEnum,
    externalId: string,
  ): Promise<IntegrationConnection | null> {
    const orm = await this.repo.findOne({ where: { provider, externalId } });
    return orm ? IntegrationConnectionMapper.toDomain(orm) : null;
  }

  async findById(uuid: string): Promise<IntegrationConnection | null> {
    const orm = await this.repo.findOne({ where: { uuid } });
    return orm ? IntegrationConnectionMapper.toDomain(orm) : null;
  }

  async save(connection: IntegrationConnection): Promise<void> {
    const orm = IntegrationConnectionMapper.toOrm(connection);
    // uuid là business key — tra `id` (PK bigint nội bộ) của bản ghi đã tồn tại
    // trước khi save, nếu không TypeORM sẽ INSERT trùng thay vì UPDATE.
    const existing = await this.repo.findOne({
      where: { uuid: orm.uuid },
      select: { id: true },
    });
    if (existing) {
      orm.id = existing.id;
    }
    await this.repo.save(orm);
  }
}
```

- [ ] **Step 2: Implement `TypeOrmZaloOaMessageRepository`**

```ts
// src/modules/integrations/infrastructure/persistence/repositories/typeorm-zalo-oa-message.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  IZaloOaMessageRepository,
  ZaloOaMessagePage,
} from '@/modules/integrations/domain/repositories/zalo-oa-message.repository.interface';
import type { ZaloOaMessage } from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { paginateByUuidCursor } from '@/shared/infrastructure/persistence/cursor-pagination.util';
import { ZaloOaMessageOrmEntity } from '../entities/zalo-oa-message.orm-entity';
import { ZaloOaMessageMapper } from '../mappers/zalo-oa-message.mapper';

@Injectable()
export class TypeOrmZaloOaMessageRepository
  implements IZaloOaMessageRepository
{
  constructor(
    @InjectRepository(ZaloOaMessageOrmEntity)
    private readonly repo: Repository<ZaloOaMessageOrmEntity>,
  ) {}

  async save(message: ZaloOaMessage): Promise<void> {
    const orm = ZaloOaMessageMapper.toOrm(message);
    await this.repo.save(orm);
  }

  async existsByExternalMessageId(
    connectionId: string,
    externalMessageId: string,
  ): Promise<boolean> {
    const count = await this.repo.count({
      where: { connectionId, externalMessageId },
    });
    return count > 0;
  }

  async findByConnection(
    connectionId: string,
    params: { cursor?: string; limit?: number },
  ): Promise<ZaloOaMessagePage> {
    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.connection_id = :connectionId', { connectionId });

    const { items, meta } = await paginateByUuidCursor(qb, 'm', {
      cursor: params.cursor,
      limit: params.limit,
      order: 'DESC',
    });

    return {
      items: items.map((orm) => ZaloOaMessageMapper.toDomain(orm)),
      hasNextPage: meta.hasNextPage,
      nextCursor: meta.nextCursor,
    };
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/integrations/infrastructure/persistence/repositories
git commit -m "feat(integrations): add TypeORM repositories for connection and messages"
```

---

### Task 8: Interface dùng chung (`IMessagingGateway`, `IOAuthConnectable`) + `IntegrationGatewayFactory`

**Files:**
- Create: `src/modules/integrations/domain/services/messaging-gateway.interface.ts`
- Create: `src/modules/integrations/domain/services/oauth-connectable.interface.ts`
- Create: `src/modules/integrations/infrastructure/gateways/integration-gateway.factory.ts`
- Test: `src/modules/integrations/infrastructure/gateways/integration-gateway.factory.spec.ts`

**Interfaces:**
- Consumes: `IntegrationProviderEnum` (Task 2).
- Produces:
  - `interface SendMessageParams { connectionId: string; to: string; content: string; type?: string }`
  - `interface SendMessageResult { externalMessageId: string }`
  - `interface IMessagingGateway { getProvider(): IntegrationProviderEnum; sendMessage(params: SendMessageParams): Promise<SendMessageResult> }`
  - `interface ExchangedToken { accessToken: string; refreshToken: string; expiresIn: number }`
  - `interface IOAuthConnectable { getAuthUrl(state: string): string; exchangeCode(code: string): Promise<ExchangedToken>; refreshAccessToken(refreshToken: string): Promise<ExchangedToken> }`
  - `class IntegrationGatewayFactory { getMessagingGateway(provider: IntegrationProviderEnum): IMessagingGateway }` — nhận danh sách `IMessagingGateway[]` qua constructor (Nest tự inject multi-provider bằng token riêng, xem Task 14), map theo `getProvider()`.

- [ ] **Step 1: Viết test cho factory (dùng fake gateway, không phụ thuộc ZaloOaGateway thật)**

```ts
// src/modules/integrations/infrastructure/gateways/integration-gateway.factory.spec.ts
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
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/infrastructure/gateways/integration-gateway.factory.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Tạo `messaging-gateway.interface.ts`**

```ts
// src/modules/integrations/domain/services/messaging-gateway.interface.ts
import type { IntegrationProviderEnum } from '../value-objects/integration-provider.vo';

export interface SendMessageParams {
  connectionId: string;
  to: string;
  content: string;
  type?: string;
}

export interface SendMessageResult {
  externalMessageId: string;
}

export interface IMessagingGateway {
  getProvider(): IntegrationProviderEnum;
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
}
```

- [ ] **Step 4: Tạo `oauth-connectable.interface.ts`**

```ts
// src/modules/integrations/domain/services/oauth-connectable.interface.ts
export interface ExchangedToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // giây
}

export interface IOAuthConnectable {
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<ExchangedToken>;
  refreshAccessToken(refreshToken: string): Promise<ExchangedToken>;
}
```

- [ ] **Step 5: Implement factory**

```ts
// src/modules/integrations/infrastructure/gateways/integration-gateway.factory.ts
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

  constructor(
    @Inject(MESSAGING_GATEWAYS) gateways: IMessagingGateway[],
  ) {
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
```

Test ở Step 1 gọi `new IntegrationGatewayFactory([new FakeZaloGateway()])` trực
tiếp (bỏ qua DI, truyền mảng thẳng vào constructor) nên không cần biết token DI —
token `MESSAGING_GATEWAYS` chỉ dùng khi Nest wiring thật (Task 14).

- [ ] **Step 6: Tạo DI token cho multi-provider injection**

```ts
// src/modules/integrations/infrastructure/gateways/messaging-gateways.token.ts
export const MESSAGING_GATEWAYS = Symbol('MESSAGING_GATEWAYS');
```

- [ ] **Step 7: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/infrastructure/gateways/integration-gateway.factory.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 8: Commit**

```bash
git add src/modules/integrations/domain/services src/modules/integrations/infrastructure/gateways
git commit -m "feat(integrations): add messaging/oauth ports and gateway factory"
```

---

### Task 9: `ZaloOaStateService` (ký/verify state token chống CSRF)

**Files:**
- Create: `src/modules/integrations/infrastructure/services/zalo-oa-state.service.ts`
- Test: `src/modules/integrations/infrastructure/services/zalo-oa-state.service.spec.ts`

**Interfaces:**
- Consumes: `JwtService` (`@nestjs/jwt`, đã có sẵn trong repo), `ConfigService` (`@nestjs/config`).
- Produces: `class ZaloOaStateService { signState(merchantId: string): Promise<string>; verifyState(state: string): Promise<{ merchantId: string }> }`
  (`verifyState` throw `UnauthorizedException` nếu state sai/hết hạn).

- [ ] **Step 1: Viết test**

```ts
// src/modules/integrations/infrastructure/services/zalo-oa-state.service.spec.ts
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ZaloOaStateService } from './zalo-oa-state.service';

describe('ZaloOaStateService', () => {
  const jwtService = new JwtService({});
  const configService = {
    getOrThrow: jest.fn().mockReturnValue('state-secret'),
  } as unknown as ConfigService;
  const service = new ZaloOaStateService(jwtService, configService);

  it('signState() rồi verifyState() trả lại đúng merchantId', async () => {
    const state = await service.signState('merchant-1');
    const payload = await service.verifyState(state);
    expect(payload.merchantId).toBe('merchant-1');
  });

  it('verifyState() throw UnauthorizedException khi token sai', async () => {
    await expect(service.verifyState('token-gia')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifyState() throw UnauthorizedException khi ký bằng secret khác', async () => {
    const otherService = new ZaloOaStateService(jwtService, {
      getOrThrow: jest.fn().mockReturnValue('secret-khac'),
    } as unknown as ConfigService);
    const state = await otherService.signState('merchant-1');

    await expect(service.verifyState(state)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/infrastructure/services/zalo-oa-state.service.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement**

```ts
// src/modules/integrations/infrastructure/services/zalo-oa-state.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface ZaloOaStatePayload {
  merchantId: string;
}

@Injectable()
export class ZaloOaStateService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async signState(merchantId: string): Promise<string> {
    const secret = this.configService.getOrThrow<string>(
      'ZALO_OA_STATE_SECRET',
    );
    return this.jwtService.signAsync(
      { merchantId },
      { secret, expiresIn: '5m' },
    );
  }

  async verifyState(state: string): Promise<ZaloOaStatePayload> {
    const secret = this.configService.getOrThrow<string>(
      'ZALO_OA_STATE_SECRET',
    );
    try {
      const payload = await this.jwtService.verifyAsync<ZaloOaStatePayload>(
        state,
        { secret },
      );
      return { merchantId: payload.merchantId };
    } catch {
      throw new UnauthorizedException(
        'Liên kết Zalo OA không hợp lệ hoặc đã hết hạn, vui lòng thử lại.',
      );
    }
  }
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/infrastructure/services/zalo-oa-state.service.spec.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add src/modules/integrations/infrastructure/services
git commit -m "feat(integrations): add Zalo OA state token service for OAuth CSRF protection"
```

---

### Task 10: `ZaloOaGateway` — implement `IMessagingGateway` + `IOAuthConnectable`

**Files:**
- Create: `src/modules/integrations/infrastructure/gateways/zalo-oa.gateway.ts`
- Test: `src/modules/integrations/infrastructure/gateways/zalo-oa.gateway.spec.ts`

**Interfaces:**
- Consumes: `IMessagingGateway`, `IOAuthConnectable`, `ExchangedToken`, `SendMessageParams`,
  `SendMessageResult` (Task 8); `IIntegrationConnectionRepository`, `INTEGRATION_CONNECTION_REPOSITORY`
  (Task 3); `IntegrationConnection.isTokenExpiringSoon()/updateTokens()/getAccessToken()`
  (Task 3); `axios` (đã có trong `dependencies`).
- Produces: `class ZaloOaGateway implements IMessagingGateway, IOAuthConnectable`.

Zalo OA endpoint dùng thật (theo tài liệu Zalo OA Developers — Xác thực & Ủy quyền):
- Auth URL: `https://oauth.zaloapp.com/v4/oa/permission?app_id={appId}&redirect_uri={redirectUri}&state={state}`
- Exchange code: `POST https://oauth.zaloapp.com/v4/oa/access_token`, header `secret_key`,
  body `application/x-www-form-urlencoded` `{ app_id, code, grant_type: 'authorization_code' }`
- Refresh token: cùng endpoint, body `{ app_id, refresh_token, grant_type: 'refresh_token' }`
- Gửi tin: `POST https://openapi.zalo.me/v3.0/oa/message/cs`, header `access_token`,
  body JSON `{ recipient: { user_id }, message: { text } }`

- [ ] **Step 1: Viết test (mock `axios` và repository)**

```ts
// src/modules/integrations/infrastructure/gateways/zalo-oa.gateway.spec.ts
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import { ZaloOaGateway } from './zalo-oa.gateway';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZaloOaGateway', () => {
  const configService = {
    getOrThrow: jest.fn((key: string) => {
      const map: Record<string, string> = {
        ZALO_OA_APP_ID: 'app-id',
        ZALO_OA_SECRET_KEY: 'secret-key',
        ZALO_OA_REDIRECT_URI: 'https://api.example.com/callback',
      };
      return map[key];
    }),
  } as unknown as ConfigService;

  const connectionRepo = {
    findById: jest.fn(),
    save: jest.fn(),
  } as any;

  const gateway = new ZaloOaGateway(configService, connectionRepo);

  beforeEach(() => jest.clearAllMocks());

  it('getProvider() trả ZALO_OA', () => {
    expect(gateway.getProvider()).toBe(IntegrationProviderEnum.ZALO_OA);
  });

  it('getAuthUrl() sinh đúng URL với app_id/redirect_uri/state', () => {
    const url = gateway.getAuthUrl('state-abc');
    expect(url).toBe(
      'https://oauth.zaloapp.com/v4/oa/permission?app_id=app-id&redirect_uri=https%3A%2F%2Fapi.example.com%2Fcallback&state=state-abc',
    );
  });

  it('exchangeCode() gọi Zalo API và map kết quả', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        access_token: 'acc-1',
        refresh_token: 'ref-1',
        expires_in: '3600',
      },
    });

    const result = await gateway.exchangeCode('code-123');

    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://oauth.zaloapp.com/v4/oa/access_token',
      expect.any(URLSearchParams),
      expect.objectContaining({
        headers: expect.objectContaining({ secret_key: 'secret-key' }),
      }),
    );
    expect(result).toEqual({
      accessToken: 'acc-1',
      refreshToken: 'ref-1',
      expiresIn: 3600,
    });
  });

  it('exchangeCode() throw BadGatewayException khi Zalo trả lỗi', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { error: 1, error_description: 'Code không hợp lệ' },
    });

    await expect(gateway.exchangeCode('code-sai')).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('sendMessage() dùng access token hiện có khi chưa sắp hết hạn', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-1',
      {
        accessToken: 'acc-valid',
        refreshToken: 'ref-1',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    );
    connectionRepo.findById.mockResolvedValueOnce(connection);
    mockedAxios.post.mockResolvedValueOnce({
      data: { data: { message_id: 'msg-out-1' } },
    });

    const result = await gateway.sendMessage({
      connectionId: connection.getUuid(),
      to: 'zalo-user-1',
      content: 'Xin chào',
    });

    expect(result).toEqual({ externalMessageId: 'msg-out-1' });
    expect(connectionRepo.save).not.toHaveBeenCalled();
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://openapi.zalo.me/v3.0/oa/message/cs',
      { recipient: { user_id: 'zalo-user-1' }, message: { text: 'Xin chào' } },
      expect.objectContaining({
        headers: expect.objectContaining({ access_token: 'acc-valid' }),
      }),
    );
  });

  it('sendMessage() refresh token trước khi gửi khi token sắp hết hạn', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-1',
      {
        accessToken: 'acc-old',
        refreshToken: 'ref-old',
        expiresAt: new Date(Date.now() + 60_000), // còn 1 phút
      },
    );
    connectionRepo.findById.mockResolvedValueOnce(connection);
    mockedAxios.post
      .mockResolvedValueOnce({
        data: {
          access_token: 'acc-new',
          refresh_token: 'ref-new',
          expires_in: '3600',
        },
      })
      .mockResolvedValueOnce({ data: { data: { message_id: 'msg-out-2' } } });

    const result = await gateway.sendMessage({
      connectionId: connection.getUuid(),
      to: 'zalo-user-1',
      content: 'Xin chào',
    });

    expect(result).toEqual({ externalMessageId: 'msg-out-2' });
    expect(connectionRepo.save).toHaveBeenCalledTimes(1);
    expect(connection.getAccessToken()).toBe('acc-new');
    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      'https://openapi.zalo.me/v3.0/oa/message/cs',
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ access_token: 'acc-new' }),
      }),
    );
  });

  it('sendMessage() throw UnauthorizedException khi connection không tồn tại', async () => {
    connectionRepo.findById.mockResolvedValueOnce(null);
    await expect(
      gateway.sendMessage({ connectionId: 'x', to: 'y', content: 'z' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/infrastructure/gateways/zalo-oa.gateway.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `ZaloOaGateway`**

```ts
// src/modules/integrations/infrastructure/gateways/zalo-oa.gateway.ts
import {
  Inject,
  Injectable,
  Logger,
  BadGatewayException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type {
  IMessagingGateway,
  SendMessageParams,
  SendMessageResult,
} from '../../domain/services/messaging-gateway.interface';
import type {
  ExchangedToken,
  IOAuthConnectable,
} from '../../domain/services/oauth-connectable.interface';
import { IntegrationProviderEnum } from '../../domain/value-objects/integration-provider.vo';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '../../domain/repositories/integration-connection.repository.interface';

const ZALO_OAUTH_TOKEN_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';
const ZALO_OAUTH_PERMISSION_URL = 'https://oauth.zaloapp.com/v4/oa/permission';
const ZALO_SEND_MESSAGE_URL = 'https://openapi.zalo.me/v3.0/oa/message/cs';

@Injectable()
export class ZaloOaGateway implements IMessagingGateway, IOAuthConnectable {
  private readonly logger = new Logger(ZaloOaGateway.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
  ) {}

  getProvider(): IntegrationProviderEnum {
    return IntegrationProviderEnum.ZALO_OA;
  }

  getAuthUrl(state: string): string {
    const appId = this.configService.getOrThrow<string>('ZALO_OA_APP_ID');
    const redirectUri = this.configService.getOrThrow<string>(
      'ZALO_OA_REDIRECT_URI',
    );
    const params = new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      state,
    });
    return `${ZALO_OAUTH_PERMISSION_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<ExchangedToken> {
    const appId = this.configService.getOrThrow<string>('ZALO_OA_APP_ID');
    const secretKey = this.configService.getOrThrow<string>(
      'ZALO_OA_SECRET_KEY',
    );

    const body = new URLSearchParams({
      app_id: appId,
      code,
      grant_type: 'authorization_code',
    });

    return this.callTokenEndpoint(body, secretKey);
  }

  async refreshAccessToken(refreshToken: string): Promise<ExchangedToken> {
    const appId = this.configService.getOrThrow<string>('ZALO_OA_APP_ID');
    const secretKey = this.configService.getOrThrow<string>(
      'ZALO_OA_SECRET_KEY',
    );

    const body = new URLSearchParams({
      app_id: appId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    return this.callTokenEndpoint(body, secretKey);
  }

  private async callTokenEndpoint(
    body: URLSearchParams,
    secretKey: string,
  ): Promise<ExchangedToken> {
    try {
      const response = await axios.post(ZALO_OAUTH_TOKEN_URL, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          secret_key: secretKey,
        },
      });

      const data = response.data;
      if (!data?.access_token || !data?.refresh_token) {
        this.logger.error(`Zalo OA token error: ${JSON.stringify(data)}`);
        throw new BadGatewayException(
          `Zalo trả về lỗi khi lấy access token: ${data?.error_description || 'unknown error'}`,
        );
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: Number(data.expires_in),
      };
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const errorMsg = error?.response?.data || error?.message;
      this.logger.error(`Lỗi gọi Zalo OA token API: ${JSON.stringify(errorMsg)}`);
      throw new BadGatewayException('Không thể kết nối tới Zalo OA.');
    }
  }

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const connection = await this.connectionRepo.findById(params.connectionId);
    if (!connection) {
      throw new UnauthorizedException(
        'Chưa liên kết Zalo OA hoặc liên kết không tồn tại.',
      );
    }

    let accessToken = connection.getAccessToken();
    if (
      connection.isTokenExpiringSoon() &&
      connection.getRefreshToken()
    ) {
      const refreshed = await this.refreshAccessToken(
        connection.getRefreshToken()!,
      );
      connection.updateTokens({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      });
      await this.connectionRepo.save(connection);
      accessToken = refreshed.accessToken;
    }

    if (!accessToken) {
      throw new UnauthorizedException(
        'Liên kết Zalo OA chưa có access token hợp lệ.',
      );
    }

    try {
      const response = await axios.post(
        ZALO_SEND_MESSAGE_URL,
        {
          recipient: { user_id: params.to },
          message: { text: params.content },
        },
        { headers: { access_token: accessToken } },
      );

      const messageId = response.data?.data?.message_id;
      if (!messageId) {
        this.logger.error(
          `Zalo OA send message error: ${JSON.stringify(response.data)}`,
        );
        throw new BadGatewayException(
          `Zalo từ chối gửi tin: ${response.data?.message || 'unknown error'}`,
        );
      }

      return { externalMessageId: messageId };
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      const errorMsg = error?.response?.data || error?.message;
      this.logger.error(`Lỗi gọi Zalo OA send message API: ${JSON.stringify(errorMsg)}`);
      throw new BadGatewayException('Không thể gửi tin nhắn qua Zalo OA.');
    }
  }
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/infrastructure/gateways/zalo-oa.gateway.spec.ts`
Expected: PASS (7 test)

- [ ] **Step 5: Commit**

```bash
git add src/modules/integrations/infrastructure/gateways/zalo-oa.gateway.ts src/modules/integrations/infrastructure/gateways/zalo-oa.gateway.spec.ts
git commit -m "feat(integrations): implement ZaloOaGateway (OAuth exchange, refresh, send message)"
```

---

### Task 11: `LinkZaloOaHandler` (xử lý callback OAuth)

**Files:**
- Create: `src/modules/integrations/application/commands/link-zalo-oa/link-zalo-oa.command.ts`
- Create: `src/modules/integrations/application/commands/link-zalo-oa/link-zalo-oa.handler.ts`
- Test: `src/modules/integrations/application/commands/link-zalo-oa/link-zalo-oa.handler.spec.ts`

**Interfaces:**
- Consumes: `ZaloOaGateway.exchangeCode()` (Task 10, dùng qua type `IOAuthConnectable`),
  `IIntegrationConnectionRepository` (Task 3), `IntegrationConnection.create()`/`updateTokens()`.
- Produces:
  - `class LinkZaloOaCommand { constructor(public readonly merchantId: string, public readonly code: string, public readonly oaId: string) {} }`
  - `class LinkZaloOaHandler { constructor(gateway: IOAuthConnectable-compatible ZaloOaGateway, repo); execute(cmd: LinkZaloOaCommand): Promise<IntegrationConnection> }`

- [ ] **Step 1: Viết test**

```ts
// src/modules/integrations/application/commands/link-zalo-oa/link-zalo-oa.handler.spec.ts
import { LinkZaloOaHandler } from './link-zalo-oa.handler';
import { LinkZaloOaCommand } from './link-zalo-oa.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('LinkZaloOaHandler', () => {
  const gateway = {
    exchangeCode: jest.fn(),
  } as any;
  const repo = {
    findByMerchantAndProvider: jest.fn(),
    save: jest.fn(),
  } as any;
  const handler = new LinkZaloOaHandler(gateway, repo);

  beforeEach(() => jest.clearAllMocks());

  it('tạo mới connection khi merchant chưa liên kết OA nào', async () => {
    gateway.exchangeCode.mockResolvedValueOnce({
      accessToken: 'acc-1',
      refreshToken: 'ref-1',
      expiresIn: 3600,
    });
    repo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    const result = await handler.execute(
      new LinkZaloOaCommand('merchant-1', 'code-abc', 'oa-123'),
    );

    expect(gateway.exchangeCode).toHaveBeenCalledWith('code-abc');
    expect(result.getMerchantId()).toBe('merchant-1');
    expect(result.getExternalId()).toBe('oa-123');
    expect(result.getProvider()).toBe(IntegrationProviderEnum.ZALO_OA);
    expect(repo.save).toHaveBeenCalledWith(result);
  });

  it('cập nhật token của connection cũ khi merchant liên kết lại', async () => {
    const existing = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-cu',
      {
        accessToken: 'acc-cu',
        refreshToken: 'ref-cu',
        expiresAt: new Date(Date.now() - 1000),
      },
    );
    repo.findByMerchantAndProvider.mockResolvedValueOnce(existing);
    gateway.exchangeCode.mockResolvedValueOnce({
      accessToken: 'acc-moi',
      refreshToken: 'ref-moi',
      expiresIn: 3600,
    });

    const result = await handler.execute(
      new LinkZaloOaCommand('merchant-1', 'code-moi', 'oa-moi'),
    );

    expect(result.getUuid()).toBe(existing.getUuid()); // vẫn là cùng 1 bản ghi
    expect(result.getAccessToken()).toBe('acc-moi');
    expect(repo.save).toHaveBeenCalledWith(existing);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/application/commands/link-zalo-oa/link-zalo-oa.handler.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Tạo command**

```ts
// src/modules/integrations/application/commands/link-zalo-oa/link-zalo-oa.command.ts
export class LinkZaloOaCommand {
  constructor(
    public readonly merchantId: string,
    public readonly code: string,
    public readonly oaId: string,
  ) {}
}
```

- [ ] **Step 4: Implement handler**

```ts
// src/modules/integrations/application/commands/link-zalo-oa/link-zalo-oa.handler.ts
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
```

`ZALO_OA_OAUTH_CONNECTABLE` là token DI riêng để inject `ZaloOaGateway` vào các
handler chỉ cần phần `IOAuthConnectable` (tách khỏi `MESSAGING_GATEWAYS` — cùng 1
instance `ZaloOaGateway` nhưng handler chỉ phụ thuộc vào interface nó cần, đúng
nguyên tắc Interface Segregation).

- [ ] **Step 5: Tạo token DI cho `IOAuthConnectable`**

```ts
// src/modules/integrations/application/ports/zalo-oa-oauth-connectable.token.ts
export const ZALO_OA_OAUTH_CONNECTABLE = Symbol('ZaloOaOAuthConnectable');
```

- [ ] **Step 6: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/application/commands/link-zalo-oa/link-zalo-oa.handler.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 7: Commit**

```bash
git add src/modules/integrations/application/commands/link-zalo-oa src/modules/integrations/application/ports
git commit -m "feat(integrations): add LinkZaloOaHandler for OAuth callback processing"
```

---

### Task 12: `GetIntegrationStatusHandler`

**Files:**
- Create: `src/modules/integrations/application/queries/get-integration-status/get-integration-status.query.ts`
- Create: `src/modules/integrations/application/queries/get-integration-status/get-integration-status.handler.ts`
- Test: `src/modules/integrations/application/queries/get-integration-status/get-integration-status.handler.spec.ts`

**Interfaces:**
- Consumes: `IIntegrationConnectionRepository` (Task 3).
- Produces:
  - `class GetIntegrationStatusQuery { constructor(public readonly merchantId: string, public readonly provider: IntegrationProviderEnum) {} }`
  - `interface IntegrationStatusResult { connected: boolean; externalId?: string; status?: IntegrationStatusEnum; metadata?: Record<string, any> }`
  - `class GetIntegrationStatusHandler { execute(query): Promise<IntegrationStatusResult> }`

- [ ] **Step 1: Viết test**

```ts
// src/modules/integrations/application/queries/get-integration-status/get-integration-status.handler.spec.ts
import { GetIntegrationStatusHandler } from './get-integration-status.handler';
import { GetIntegrationStatusQuery } from './get-integration-status.query';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('GetIntegrationStatusHandler', () => {
  const repo = { findByMerchantAndProvider: jest.fn() } as any;
  const handler = new GetIntegrationStatusHandler(repo);

  it('trả connected=false khi chưa liên kết', async () => {
    repo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    const result = await handler.execute(
      new GetIntegrationStatusQuery('merchant-1', IntegrationProviderEnum.ZALO_OA),
    );

    expect(result).toEqual({ connected: false });
  });

  it('trả thông tin liên kết khi đã liên kết', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      {
        accessToken: 'a',
        refreshToken: 'b',
        expiresAt: new Date(Date.now() + 3600_000),
      },
      { name: 'Shop ABC' },
    );
    repo.findByMerchantAndProvider.mockResolvedValueOnce(connection);

    const result = await handler.execute(
      new GetIntegrationStatusQuery('merchant-1', IntegrationProviderEnum.ZALO_OA),
    );

    expect(result.connected).toBe(true);
    expect(result.externalId).toBe('oa-123');
    expect(result.metadata).toEqual({ name: 'Shop ABC' });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/application/queries/get-integration-status/get-integration-status.handler.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Tạo query**

```ts
// src/modules/integrations/application/queries/get-integration-status/get-integration-status.query.ts
import type { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

export class GetIntegrationStatusQuery {
  constructor(
    public readonly merchantId: string,
    public readonly provider: IntegrationProviderEnum,
  ) {}
}
```

- [ ] **Step 4: Implement handler**

```ts
// src/modules/integrations/application/queries/get-integration-status/get-integration-status.handler.ts
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
```

- [ ] **Step 5: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/application/queries/get-integration-status/get-integration-status.handler.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/application/queries/get-integration-status
git commit -m "feat(integrations): add GetIntegrationStatusHandler"
```

---

### Task 13: `SendZaloOaMessageHandler`

**Files:**
- Create: `src/modules/integrations/application/commands/send-zalo-oa-message/send-zalo-oa-message.command.ts`
- Create: `src/modules/integrations/application/commands/send-zalo-oa-message/send-zalo-oa-message.handler.ts`
- Test: `src/modules/integrations/application/commands/send-zalo-oa-message/send-zalo-oa-message.handler.spec.ts`

**Interfaces:**
- Consumes: `IIntegrationConnectionRepository`, `IZaloOaMessageRepository` (Task 3/4),
  `IntegrationGatewayFactory.getMessagingGateway()` (Task 8), `ZaloOaMessage.create()` (Task 4).
- Produces:
  - `class SendZaloOaMessageCommand { constructor(public readonly merchantId: string, public readonly to: string, public readonly content: string, public readonly type?: string) {} }`
  - `class SendZaloOaMessageHandler { execute(cmd): Promise<{ externalMessageId: string }> }`
    (throw `NotFoundException` nếu merchant chưa liên kết OA)

- [ ] **Step 1: Viết test**

```ts
// src/modules/integrations/application/commands/send-zalo-oa-message/send-zalo-oa-message.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { SendZaloOaMessageHandler } from './send-zalo-oa-message.handler';
import { SendZaloOaMessageCommand } from './send-zalo-oa-message.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('SendZaloOaMessageHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const messageRepo = { save: jest.fn() } as any;
  const gatewayFactory = {
    getMessagingGateway: jest.fn(),
  } as any;
  const handler = new SendZaloOaMessageHandler(
    connectionRepo,
    messageRepo,
    gatewayFactory,
  );

  beforeEach(() => jest.clearAllMocks());

  it('gửi tin thành công và lưu message OUT', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      {
        accessToken: 'a',
        refreshToken: 'b',
        expiresAt: new Date(Date.now() + 3600_000),
      },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    const sendMessage = jest
      .fn()
      .mockResolvedValueOnce({ externalMessageId: 'msg-out-1' });
    gatewayFactory.getMessagingGateway.mockReturnValueOnce({ sendMessage });

    const result = await handler.execute(
      new SendZaloOaMessageCommand('merchant-1', 'zalo-user-1', 'Xin chào'),
    );

    expect(result).toEqual({ externalMessageId: 'msg-out-1' });
    expect(sendMessage).toHaveBeenCalledWith({
      connectionId: connection.getUuid(),
      to: 'zalo-user-1',
      content: 'Xin chào',
      type: undefined,
    });
    expect(messageRepo.save).toHaveBeenCalledTimes(1);
    const savedMessage = messageRepo.save.mock.calls[0][0];
    expect(savedMessage.getExternalMessageId()).toBe('msg-out-1');
    expect(savedMessage.getZaloUserId()).toBe('zalo-user-1');
  });

  it('throw NotFoundException khi merchant chưa liên kết OA', async () => {
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    await expect(
      handler.execute(
        new SendZaloOaMessageCommand('merchant-1', 'zalo-user-1', 'Xin chào'),
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/application/commands/send-zalo-oa-message/send-zalo-oa-message.handler.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Tạo command**

```ts
// src/modules/integrations/application/commands/send-zalo-oa-message/send-zalo-oa-message.command.ts
export class SendZaloOaMessageCommand {
  constructor(
    public readonly merchantId: string,
    public readonly to: string,
    public readonly content: string,
    public readonly type?: string,
  ) {}
}
```

- [ ] **Step 4: Implement handler**

```ts
// src/modules/integrations/application/commands/send-zalo-oa-message/send-zalo-oa-message.handler.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import {
  ZALO_OA_MESSAGE_REPOSITORY,
  type IZaloOaMessageRepository,
} from '@/modules/integrations/domain/repositories/zalo-oa-message.repository.interface';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import {
  ZaloOaMessage,
  ZaloOaMessageDirectionEnum,
} from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { IntegrationGatewayFactory } from '@/modules/integrations/infrastructure/gateways/integration-gateway.factory';
import { SendZaloOaMessageCommand } from './send-zalo-oa-message.command';

@Injectable()
export class SendZaloOaMessageHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZALO_OA_MESSAGE_REPOSITORY)
    private readonly messageRepo: IZaloOaMessageRepository,
    private readonly gatewayFactory: IntegrationGatewayFactory,
  ) {}

  async execute(
    cmd: SendZaloOaMessageCommand,
  ): Promise<{ externalMessageId: string }> {
    const connection = await this.connectionRepo.findByMerchantAndProvider(
      cmd.merchantId,
      IntegrationProviderEnum.ZALO_OA,
    );
    if (!connection) {
      throw new NotFoundException(
        'Merchant chưa liên kết Zalo OA, vui lòng liên kết trước khi gửi tin.',
      );
    }

    const gateway = this.gatewayFactory.getMessagingGateway(
      IntegrationProviderEnum.ZALO_OA,
    );
    const result = await gateway.sendMessage({
      connectionId: connection.getUuid(),
      to: cmd.to,
      content: cmd.content,
      type: cmd.type,
    });

    const message = ZaloOaMessage.create({
      connectionId: connection.getUuid(),
      direction: ZaloOaMessageDirectionEnum.OUT,
      zaloUserId: cmd.to,
      content: cmd.content,
      messageType: cmd.type || 'text',
      externalMessageId: result.externalMessageId,
      sentAt: new Date(),
    });
    await this.messageRepo.save(message);

    return result;
  }
}
```

- [ ] **Step 5: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/application/commands/send-zalo-oa-message/send-zalo-oa-message.handler.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/application/commands/send-zalo-oa-message
git commit -m "feat(integrations): add SendZaloOaMessageHandler"
```

---

### Task 14: Xác thực chữ ký webhook + `SyncZaloOaWebhookEventHandler`

**Files:**
- Create: `src/modules/integrations/infrastructure/webhook/verify-zalo-oa-webhook-signature.ts`
- Create: `src/modules/integrations/application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.command.ts`
- Create: `src/modules/integrations/application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler.ts`
- Test: `src/modules/integrations/infrastructure/webhook/verify-zalo-oa-webhook-signature.spec.ts`
- Test: `src/modules/integrations/application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler.spec.ts`

**Interfaces:**
- Consumes: `IIntegrationConnectionRepository.findByExternalId()`, `IZaloOaMessageRepository`
  (Task 3/4), `ZaloOaMessage.create()`.
- Produces:
  - `function verifyZaloOaWebhookSignature(rawBody: Record<string, any>, secretKey: string): boolean`
  - `class SyncZaloOaWebhookEventCommand { constructor(public readonly oaId: string, public readonly eventName: string, public readonly senderId: string, public readonly messageText: string, public readonly messageId: string | undefined, public readonly timestamp: number) {} }`
  - `class SyncZaloOaWebhookEventHandler { execute(cmd): Promise<void> }` (bỏ qua nếu không
    tìm thấy connection, hoặc `messageId` đã tồn tại — idempotent; các `eventName` khác
    `user_send_text` chỉ log, không lưu message)

Chữ ký webhook dùng HMAC-SHA256 trên toàn bộ payload (trừ field `mac`), theo đúng
kiểu `MoMoGateway.verifyWebhook()` đang dùng trong repo — **xác nhận lại công thức
chính xác với tài liệu Webhook mới nhất của Zalo OA trước khi bật webhook ở môi
trường production** (đã ghi chú trong spec §8, ngoài phạm vi kiểm chứng của task này
do không có sandbox Zalo thật).

- [ ] **Step 1: Viết test cho verify signature**

```ts
// src/modules/integrations/infrastructure/webhook/verify-zalo-oa-webhook-signature.spec.ts
import * as crypto from 'crypto';
import { verifyZaloOaWebhookSignature } from './verify-zalo-oa-webhook-signature';

describe('verifyZaloOaWebhookSignature', () => {
  const secretKey = 'secret-key';

  it('trả true khi mac khớp', () => {
    const rest = { app_id: 'app-1', event_name: 'user_send_text' };
    const mac = crypto
      .createHmac('sha256', secretKey)
      .update(JSON.stringify(rest))
      .digest('hex');

    expect(
      verifyZaloOaWebhookSignature({ ...rest, mac }, secretKey),
    ).toBe(true);
  });

  it('trả false khi mac không khớp (payload bị sửa)', () => {
    const rest = { app_id: 'app-1', event_name: 'user_send_text' };
    const mac = crypto
      .createHmac('sha256', secretKey)
      .update(JSON.stringify(rest))
      .digest('hex');

    expect(
      verifyZaloOaWebhookSignature(
        { app_id: 'app-1-hacked', event_name: 'user_send_text', mac },
        secretKey,
      ),
    ).toBe(false);
  });

  it('trả false khi thiếu field mac', () => {
    expect(
      verifyZaloOaWebhookSignature({ app_id: 'app-1' }, secretKey),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/infrastructure/webhook/verify-zalo-oa-webhook-signature.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement verify signature**

```ts
// src/modules/integrations/infrastructure/webhook/verify-zalo-oa-webhook-signature.ts
import * as crypto from 'crypto';

export function verifyZaloOaWebhookSignature(
  rawBody: Record<string, any>,
  secretKey: string,
): boolean {
  const { mac, ...rest } = rawBody || {};
  if (!mac || typeof mac !== 'string') {
    return false;
  }

  const calculated = crypto
    .createHmac('sha256', secretKey)
    .update(JSON.stringify(rest))
    .digest('hex');

  return calculated === mac;
}
```

- [ ] **Step 4: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/infrastructure/webhook/verify-zalo-oa-webhook-signature.spec.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Viết test cho `SyncZaloOaWebhookEventHandler`**

```ts
// src/modules/integrations/application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler.spec.ts
import { SyncZaloOaWebhookEventHandler } from './sync-zalo-oa-webhook-event.handler';
import { SyncZaloOaWebhookEventCommand } from './sync-zalo-oa-webhook-event.command';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('SyncZaloOaWebhookEventHandler', () => {
  const connectionRepo = { findByExternalId: jest.fn() } as any;
  const messageRepo = {
    save: jest.fn(),
    existsByExternalMessageId: jest.fn(),
  } as any;
  const handler = new SyncZaloOaWebhookEventHandler(connectionRepo, messageRepo);

  beforeEach(() => jest.clearAllMocks());

  it('lưu message IN khi event là user_send_text và connection tồn tại', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);
    messageRepo.existsByExternalMessageId.mockResolvedValueOnce(false);

    await handler.execute(
      new SyncZaloOaWebhookEventCommand(
        'oa-123',
        'user_send_text',
        'zalo-user-1',
        'Xin chào shop',
        'msg-in-1',
        1755936000,
      ),
    );

    expect(messageRepo.save).toHaveBeenCalledTimes(1);
    const saved = messageRepo.save.mock.calls[0][0];
    expect(saved.getContent()).toBe('Xin chào shop');
    expect(saved.getExternalMessageId()).toBe('msg-in-1');
  });

  it('bỏ qua khi message đã tồn tại (idempotent, webhook gửi trùng)', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);
    messageRepo.existsByExternalMessageId.mockResolvedValueOnce(true);

    await handler.execute(
      new SyncZaloOaWebhookEventCommand(
        'oa-123',
        'user_send_text',
        'zalo-user-1',
        'Xin chào shop',
        'msg-in-1',
        1755936000,
      ),
    );

    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it('bỏ qua khi không tìm thấy connection theo oaId', async () => {
    connectionRepo.findByExternalId.mockResolvedValueOnce(null);

    await handler.execute(
      new SyncZaloOaWebhookEventCommand(
        'oa-khong-ton-tai',
        'user_send_text',
        'zalo-user-1',
        'Xin chào',
        'msg-in-2',
        1755936000,
      ),
    );

    expect(messageRepo.save).not.toHaveBeenCalled();
  });

  it('bỏ qua khi event_name không phải user_send_text', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByExternalId.mockResolvedValueOnce(connection);

    await handler.execute(
      new SyncZaloOaWebhookEventCommand(
        'oa-123',
        'follow',
        'zalo-user-1',
        '',
        undefined,
        1755936000,
      ),
    );

    expect(messageRepo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 7: Tạo command**

```ts
// src/modules/integrations/application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.command.ts
export class SyncZaloOaWebhookEventCommand {
  constructor(
    public readonly oaId: string,
    public readonly eventName: string,
    public readonly senderId: string,
    public readonly messageText: string,
    public readonly messageId: string | undefined,
    public readonly timestamp: number,
  ) {}
}
```

- [ ] **Step 8: Implement handler**

```ts
// src/modules/integrations/application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import {
  ZALO_OA_MESSAGE_REPOSITORY,
  type IZaloOaMessageRepository,
} from '@/modules/integrations/domain/repositories/zalo-oa-message.repository.interface';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import {
  ZaloOaMessage,
  ZaloOaMessageDirectionEnum,
} from '@/modules/integrations/domain/models/zalo-oa-message.entity';
import { SyncZaloOaWebhookEventCommand } from './sync-zalo-oa-webhook-event.command';

const SUPPORTED_INBOUND_EVENTS = new Set(['user_send_text']);

@Injectable()
export class SyncZaloOaWebhookEventHandler {
  private readonly logger = new Logger(SyncZaloOaWebhookEventHandler.name);

  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZALO_OA_MESSAGE_REPOSITORY)
    private readonly messageRepo: IZaloOaMessageRepository,
  ) {}

  async execute(cmd: SyncZaloOaWebhookEventCommand): Promise<void> {
    if (!SUPPORTED_INBOUND_EVENTS.has(cmd.eventName)) {
      this.logger.log(
        `Bỏ qua sự kiện webhook Zalo OA không được đồng bộ: ${cmd.eventName}`,
      );
      return;
    }

    const connection = await this.connectionRepo.findByExternalId(
      IntegrationProviderEnum.ZALO_OA,
      cmd.oaId,
    );
    if (!connection) {
      this.logger.warn(
        `Không tìm thấy liên kết cho oa_id=${cmd.oaId}, bỏ qua sự kiện webhook.`,
      );
      return;
    }

    if (cmd.messageId) {
      const exists = await this.messageRepo.existsByExternalMessageId(
        connection.getUuid(),
        cmd.messageId,
      );
      if (exists) {
        return; // Idempotent — Zalo có thể gửi lại webhook trùng
      }
    }

    const message = ZaloOaMessage.create({
      connectionId: connection.getUuid(),
      direction: ZaloOaMessageDirectionEnum.IN,
      zaloUserId: cmd.senderId,
      content: cmd.messageText,
      messageType: 'text',
      externalMessageId: cmd.messageId,
      sentAt: new Date(cmd.timestamp * 1000),
    });

    await this.messageRepo.save(message);
  }
}
```

- [ ] **Step 9: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler.spec.ts`
Expected: PASS (4 test)

- [ ] **Step 10: Commit**

```bash
git add src/modules/integrations/infrastructure/webhook src/modules/integrations/application/commands/sync-zalo-oa-webhook-event
git commit -m "feat(integrations): add webhook signature verification and event sync handler"
```

---

### Task 15: `ListZaloOaMessagesHandler`

**Files:**
- Create: `src/modules/integrations/application/queries/list-zalo-oa-messages/list-zalo-oa-messages.query.ts`
- Create: `src/modules/integrations/application/queries/list-zalo-oa-messages/list-zalo-oa-messages.handler.ts`
- Test: `src/modules/integrations/application/queries/list-zalo-oa-messages/list-zalo-oa-messages.handler.spec.ts`

**Interfaces:**
- Consumes: `IIntegrationConnectionRepository`, `IZaloOaMessageRepository` (Task 3/4).
- Produces:
  - `class ListZaloOaMessagesQuery { constructor(public readonly merchantId: string, public readonly cursor?: string, public readonly limit?: number) {} }`
  - `class ListZaloOaMessagesHandler { execute(query): Promise<ZaloOaMessagePage> }` (throw
    `NotFoundException` nếu merchant chưa liên kết OA)

- [ ] **Step 1: Viết test**

```ts
// src/modules/integrations/application/queries/list-zalo-oa-messages/list-zalo-oa-messages.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { ListZaloOaMessagesHandler } from './list-zalo-oa-messages.handler';
import { ListZaloOaMessagesQuery } from './list-zalo-oa-messages.query';
import { IntegrationConnection } from '@/modules/integrations/domain/models/integration-connection.aggregate';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';

describe('ListZaloOaMessagesHandler', () => {
  const connectionRepo = { findByMerchantAndProvider: jest.fn() } as any;
  const messageRepo = { findByConnection: jest.fn() } as any;
  const handler = new ListZaloOaMessagesHandler(connectionRepo, messageRepo);

  beforeEach(() => jest.clearAllMocks());

  it('trả danh sách message phân trang của connection merchant', async () => {
    const connection = IntegrationConnection.create(
      'merchant-1',
      IntegrationProviderEnum.ZALO_OA,
      'oa-123',
      { accessToken: 'a', refreshToken: 'b', expiresAt: new Date() },
    );
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(connection);
    messageRepo.findByConnection.mockResolvedValueOnce({
      items: [],
      hasNextPage: false,
      nextCursor: null,
    });

    const result = await handler.execute(
      new ListZaloOaMessagesQuery('merchant-1', undefined, 20),
    );

    expect(messageRepo.findByConnection).toHaveBeenCalledWith(
      connection.getUuid(),
      { cursor: undefined, limit: 20 },
    );
    expect(result).toEqual({ items: [], hasNextPage: false, nextCursor: null });
  });

  it('throw NotFoundException khi merchant chưa liên kết OA', async () => {
    connectionRepo.findByMerchantAndProvider.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new ListZaloOaMessagesQuery('merchant-1')),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL**

Run: `npx jest src/modules/integrations/application/queries/list-zalo-oa-messages/list-zalo-oa-messages.handler.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Tạo query**

```ts
// src/modules/integrations/application/queries/list-zalo-oa-messages/list-zalo-oa-messages.query.ts
export class ListZaloOaMessagesQuery {
  constructor(
    public readonly merchantId: string,
    public readonly cursor?: string,
    public readonly limit?: number,
  ) {}
}
```

- [ ] **Step 4: Implement handler**

```ts
// src/modules/integrations/application/queries/list-zalo-oa-messages/list-zalo-oa-messages.handler.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  INTEGRATION_CONNECTION_REPOSITORY,
  type IIntegrationConnectionRepository,
} from '@/modules/integrations/domain/repositories/integration-connection.repository.interface';
import {
  ZALO_OA_MESSAGE_REPOSITORY,
  type IZaloOaMessageRepository,
  type ZaloOaMessagePage,
} from '@/modules/integrations/domain/repositories/zalo-oa-message.repository.interface';
import { IntegrationProviderEnum } from '@/modules/integrations/domain/value-objects/integration-provider.vo';
import { ListZaloOaMessagesQuery } from './list-zalo-oa-messages.query';

@Injectable()
export class ListZaloOaMessagesHandler {
  constructor(
    @Inject(INTEGRATION_CONNECTION_REPOSITORY)
    private readonly connectionRepo: IIntegrationConnectionRepository,
    @Inject(ZALO_OA_MESSAGE_REPOSITORY)
    private readonly messageRepo: IZaloOaMessageRepository,
  ) {}

  async execute(query: ListZaloOaMessagesQuery): Promise<ZaloOaMessagePage> {
    const connection = await this.connectionRepo.findByMerchantAndProvider(
      query.merchantId,
      IntegrationProviderEnum.ZALO_OA,
    );
    if (!connection) {
      throw new NotFoundException('Merchant chưa liên kết Zalo OA.');
    }

    return this.messageRepo.findByConnection(connection.getUuid(), {
      cursor: query.cursor,
      limit: query.limit,
    });
  }
}
```

- [ ] **Step 5: Chạy lại test, xác nhận PASS**

Run: `npx jest src/modules/integrations/application/queries/list-zalo-oa-messages/list-zalo-oa-messages.handler.spec.ts`
Expected: PASS (2 test)

- [ ] **Step 6: Commit**

```bash
git add src/modules/integrations/application/queries/list-zalo-oa-messages
git commit -m "feat(integrations): add ListZaloOaMessagesHandler"
```

---

### Task 16: DTOs cho request merchant

**Files:**
- Create: `src/modules/integrations/application/dtos/send-zalo-oa-message.dto.ts`
- Create: `src/modules/integrations/application/dtos/list-zalo-oa-messages.dto.ts`

**Interfaces:**
- Produces: `class SendZaloOaMessageDto { to: string; content: string; type?: string }`,
  `class ListZaloOaMessagesDto { cursor?: string; limit?: number }`.

Không cần task test riêng — đây là DTO validate bằng decorator, được xác minh gián
tiếp khi test controller thủ công (Task 17) và qua `ValidationPipe` toàn cục đã bật
sẵn ở `main.ts`.

- [ ] **Step 1: Tạo `SendZaloOaMessageDto`**

```ts
// src/modules/integrations/application/dtos/send-zalo-oa-message.dto.ts
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class SendZaloOaMessageDto {
  @IsString({ message: 'Người nhận phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Người nhận không được để trống.' })
  to: string;

  @IsString({ message: 'Nội dung phải là chuỗi ký tự.' })
  @IsNotEmpty({ message: 'Nội dung không được để trống.' })
  @MaxLength(2000, { message: 'Nội dung không được vượt quá 2000 ký tự.' })
  content: string;

  @IsOptional()
  @IsString()
  type?: string;
}
```

- [ ] **Step 2: Tạo `ListZaloOaMessagesDto`**

```ts
// src/modules/integrations/application/dtos/list-zalo-oa-messages.dto.ts
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ListZaloOaMessagesDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit phải là số nguyên.' })
  @Min(1, { message: 'Limit tối thiểu là 1.' })
  @Max(100, { message: 'Limit tối đa là 100.' })
  limit?: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/integrations/application/dtos
git commit -m "feat(integrations): add merchant-facing DTOs for Zalo OA messages"
```

---

### Task 17: Controllers (merchant + callback + webhook) + wiring module

**Files:**
- Create: `src/modules/integrations/presentation/http/zalo-oa.controller.ts`
- Create: `src/modules/integrations/presentation/http/zalo-oa-callback.controller.ts`
- Create: `src/modules/integrations/presentation/http/zalo-oa-webhook.controller.ts`
- Create: `src/modules/integrations/integrations.module.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Consumes: tất cả handler/service/gateway/repository từ Task 3–16;
  `MerchantAuthGuard` (`src/shared/infrastructure/auth/guards/auth-guards.guards.ts`).
- Produces: 6 endpoint HTTP theo bảng ở spec §9, đăng ký `IntegrationsModule` vào `AppModule`.

Không viết test HTTP cho controller — nhất quán với `MerchantController`/
`PaymentController`/`PaymentWebhookController` hiện có trong repo, vốn cũng không
có test controller riêng. Xác minh bằng chạy `npm run start:dev` + gọi thử qua
Swagger (`/api/docs` nếu có bật) hoặc `curl`, mô tả ở Step 6.

- [ ] **Step 1: Implement `ZaloOaController` (merchant-guarded)**

```ts
// src/modules/integrations/presentation/http/zalo-oa.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { MerchantAuthGuard } from '@/shared/infrastructure/auth/guards/auth-guards.guards';
import { IntegrationProviderEnum } from '../../domain/value-objects/integration-provider.vo';
import { ZaloOaStateService } from '../../infrastructure/services/zalo-oa-state.service';
import { ZaloOaGateway } from '../../infrastructure/gateways/zalo-oa.gateway';
import { GetIntegrationStatusHandler } from '../../application/queries/get-integration-status/get-integration-status.handler';
import { GetIntegrationStatusQuery } from '../../application/queries/get-integration-status/get-integration-status.query';
import { SendZaloOaMessageHandler } from '../../application/commands/send-zalo-oa-message/send-zalo-oa-message.handler';
import { SendZaloOaMessageCommand } from '../../application/commands/send-zalo-oa-message/send-zalo-oa-message.command';
import { ListZaloOaMessagesHandler } from '../../application/queries/list-zalo-oa-messages/list-zalo-oa-messages.handler';
import { ListZaloOaMessagesQuery } from '../../application/queries/list-zalo-oa-messages/list-zalo-oa-messages.query';
import { SendZaloOaMessageDto } from '../../application/dtos/send-zalo-oa-message.dto';
import { ListZaloOaMessagesDto } from '../../application/dtos/list-zalo-oa-messages.dto';

interface AuthenticatedRequest extends Request {
  user: { merchantId: string };
}

@Controller({ path: 'merchant/integrations/zalo-oa', version: '1' })
@UseGuards(MerchantAuthGuard)
export class ZaloOaController {
  constructor(
    private readonly stateService: ZaloOaStateService,
    private readonly zaloOaGateway: ZaloOaGateway,
    private readonly getStatusHandler: GetIntegrationStatusHandler,
    private readonly sendMessageHandler: SendZaloOaMessageHandler,
    private readonly listMessagesHandler: ListZaloOaMessagesHandler,
  ) {}

  @Get('connect-url')
  async getConnectUrl(@Req() req: AuthenticatedRequest) {
    const state = await this.stateService.signState(req.user.merchantId);
    return { url: this.zaloOaGateway.getAuthUrl(state) };
  }

  @Get('status')
  async getStatus(@Req() req: AuthenticatedRequest) {
    return this.getStatusHandler.execute(
      new GetIntegrationStatusQuery(
        req.user.merchantId,
        IntegrationProviderEnum.ZALO_OA,
      ),
    );
  }

  @Get('messages')
  async listMessages(
    @Req() req: AuthenticatedRequest,
    @Query() query: ListZaloOaMessagesDto,
  ) {
    return this.listMessagesHandler.execute(
      new ListZaloOaMessagesQuery(
        req.user.merchantId,
        query.cursor,
        query.limit,
      ),
    );
  }

  @Post('messages')
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Body() dto: SendZaloOaMessageDto,
  ) {
    return this.sendMessageHandler.execute(
      new SendZaloOaMessageCommand(
        req.user.merchantId,
        dto.to,
        dto.content,
        dto.type,
      ),
    );
  }
}
```

- [ ] **Step 2: Implement `ZaloOaCallbackController` (public)**

```ts
// src/modules/integrations/presentation/http/zalo-oa-callback.controller.ts
import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ZaloOaStateService } from '../../infrastructure/services/zalo-oa-state.service';
import { LinkZaloOaHandler } from '../../application/commands/link-zalo-oa/link-zalo-oa.handler';
import { LinkZaloOaCommand } from '../../application/commands/link-zalo-oa/link-zalo-oa.command';

@Controller({ path: 'integrations/zalo-oa', version: '1' })
export class ZaloOaCallbackController {
  private readonly logger = new Logger(ZaloOaCallbackController.name);

  constructor(
    private readonly stateService: ZaloOaStateService,
    private readonly linkHandler: LinkZaloOaHandler,
    private readonly configService: ConfigService,
  ) {}

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('oa_id') oaId: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const redirectBase =
      this.configService.get<string>('APP_BASE_URL') ||
      'http://localhost:3000';
    const redirectTo = `${redirectBase}/merchant/integrations/zalo-oa`;

    try {
      const { merchantId } = await this.stateService.verifyState(state);
      await this.linkHandler.execute(
        new LinkZaloOaCommand(merchantId, code, oaId),
      );
      return res.redirect(`${redirectTo}?status=success`);
    } catch (error: any) {
      this.logger.error(`Lỗi xử lý callback Zalo OA: ${error?.message}`);
      return res.redirect(`${redirectTo}?status=error`);
    }
  }
}
```

- [ ] **Step 3: Implement `ZaloOaWebhookController` (public)**

```ts
// src/modules/integrations/presentation/http/zalo-oa-webhook.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verifyZaloOaWebhookSignature } from '../../infrastructure/webhook/verify-zalo-oa-webhook-signature';
import { SyncZaloOaWebhookEventHandler } from '../../application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler';
import { SyncZaloOaWebhookEventCommand } from '../../application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.command';

@Controller({ path: 'integrations/zalo-oa', version: '1' })
export class ZaloOaWebhookController {
  private readonly logger = new Logger(ZaloOaWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly syncHandler: SyncZaloOaWebhookEventHandler,
  ) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() body: any) {
    const secretKey = this.configService.getOrThrow<string>(
      'ZALO_OA_SECRET_KEY',
    );

    if (!verifyZaloOaWebhookSignature(body, secretKey)) {
      this.logger.warn(
        `Chữ ký webhook Zalo OA không hợp lệ: ${JSON.stringify(body)}`,
      );
      return {}; // Luôn trả 200 để Zalo không retry bão, chỉ log cảnh báo
    }

    try {
      await this.syncHandler.execute(
        new SyncZaloOaWebhookEventCommand(
          body.oa_id,
          body.event_name,
          body.sender?.id,
          body.message?.text,
          body.message?.msg_id,
          Number(body.timestamp) || Math.floor(Date.now() / 1000),
        ),
      );
    } catch (error: any) {
      this.logger.error(
        `Lỗi xử lý sự kiện webhook Zalo OA: ${error?.message}`,
      );
    }

    return {};
  }
}
```

- [ ] **Step 4: Tạo `integrations.module.ts`**

```ts
// src/modules/integrations/integrations.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { IntegrationConnectionOrmEntity } from './infrastructure/persistence/entities/integration-connection.orm-entity';
import { ZaloOaMessageOrmEntity } from './infrastructure/persistence/entities/zalo-oa-message.orm-entity';
import { INTEGRATION_CONNECTION_REPOSITORY } from './domain/repositories/integration-connection.repository.interface';
import { TypeOrmIntegrationConnectionRepository } from './infrastructure/persistence/repositories/typeorm-integration-connection.repository';
import { ZALO_OA_MESSAGE_REPOSITORY } from './domain/repositories/zalo-oa-message.repository.interface';
import { TypeOrmZaloOaMessageRepository } from './infrastructure/persistence/repositories/typeorm-zalo-oa-message.repository';
import { ZaloOaGateway } from './infrastructure/gateways/zalo-oa.gateway';
import { IntegrationGatewayFactory } from './infrastructure/gateways/integration-gateway.factory';
import { MESSAGING_GATEWAYS } from './infrastructure/gateways/messaging-gateways.token';
import { ZaloOaStateService } from './infrastructure/services/zalo-oa-state.service';
import { ZALO_OA_OAUTH_CONNECTABLE } from './application/ports/zalo-oa-oauth-connectable.token';
import { LinkZaloOaHandler } from './application/commands/link-zalo-oa/link-zalo-oa.handler';
import { SendZaloOaMessageHandler } from './application/commands/send-zalo-oa-message/send-zalo-oa-message.handler';
import { SyncZaloOaWebhookEventHandler } from './application/commands/sync-zalo-oa-webhook-event/sync-zalo-oa-webhook-event.handler';
import { GetIntegrationStatusHandler } from './application/queries/get-integration-status/get-integration-status.handler';
import { ListZaloOaMessagesHandler } from './application/queries/list-zalo-oa-messages/list-zalo-oa-messages.handler';
import { ZaloOaController } from './presentation/http/zalo-oa.controller';
import { ZaloOaCallbackController } from './presentation/http/zalo-oa-callback.controller';
import { ZaloOaWebhookController } from './presentation/http/zalo-oa-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      IntegrationConnectionOrmEntity,
      ZaloOaMessageOrmEntity,
    ]),
    JwtModule.register({}),
  ],
  controllers: [
    ZaloOaController,
    ZaloOaCallbackController,
    ZaloOaWebhookController,
  ],
  providers: [
    {
      provide: INTEGRATION_CONNECTION_REPOSITORY,
      useClass: TypeOrmIntegrationConnectionRepository,
    },
    {
      provide: ZALO_OA_MESSAGE_REPOSITORY,
      useClass: TypeOrmZaloOaMessageRepository,
    },
    ZaloOaGateway,
    {
      provide: MESSAGING_GATEWAYS,
      useFactory: (zaloOaGateway: ZaloOaGateway) => [zaloOaGateway],
      inject: [ZaloOaGateway],
    },
    {
      provide: ZALO_OA_OAUTH_CONNECTABLE,
      useExisting: ZaloOaGateway,
    },
    IntegrationGatewayFactory,
    ZaloOaStateService,
    LinkZaloOaHandler,
    SendZaloOaMessageHandler,
    SyncZaloOaWebhookEventHandler,
    GetIntegrationStatusHandler,
    ListZaloOaMessagesHandler,
  ],
  exports: [INTEGRATION_CONNECTION_REPOSITORY],
})
export class IntegrationsModule {}
```

- [ ] **Step 5: Đăng ký `IntegrationsModule` vào `AppModule`**

Trong `src/app.module.ts`, thêm import và đưa vào mảng `imports`:

```ts
import { IntegrationsModule } from './modules/integrations/integrations.module';
```

```ts
    MerchantModule,
    WalletModule,
    PaymentModule,
    IntegrationsModule,
```

(thay cho đoạn 3 dòng cuối hiện tại `MerchantModule, WalletModule, PaymentModule,`)

- [ ] **Step 6: Build và kiểm thử thủ công**

```bash
npm run build
```

Expected: build thành công, không lỗi TypeScript.

Sau đó bổ sung 4 biến `ZALO_OA_APP_ID`, `ZALO_OA_SECRET_KEY`, `ZALO_OA_REDIRECT_URI`,
`ZALO_OA_STATE_SECRET` vào file `.env` cục bộ (giá trị test/sandbox từ Zalo Developers),
chạy `npm run start:dev`, rồi kiểm tra thủ công:
- `GET /api/v1/merchant/integrations/zalo-oa/status` (kèm cookie/token merchant hợp lệ)
  → trả `{ connected: false }` khi chưa liên kết.
- `GET /api/v1/merchant/integrations/zalo-oa/connect-url` → trả `{ url }` trỏ đúng
  `oauth.zaloapp.com`.

- [ ] **Step 7: Commit**

```bash
git add src/modules/integrations/presentation src/modules/integrations/integrations.module.ts src/app.module.ts
git commit -m "feat(integrations): wire Zalo OA controllers and register IntegrationsModule"
```

---

### Task 18: Kiểm tra toàn bộ (lint, build, full test suite)

**Files:** Không tạo/sửa file — chỉ chạy kiểm tra tổng.

- [ ] **Step 1: Chạy toàn bộ test suite**

```bash
npm test
```

Expected: PASS toàn bộ (bao gồm các test mới ở Task 2–16 và các test hiện có trong
repo, nếu có).

- [ ] **Step 2: Chạy lint**

```bash
npm run lint
```

Expected: không có lỗi ESLint mới phát sinh từ các file trong `src/modules/integrations`.
Sửa các lỗi lint nếu có (thường là import order/unused var) rồi chạy lại.

- [ ] **Step 3: Chạy build**

```bash
npm run build
```

Expected: PASS, không lỗi TypeScript.

- [ ] **Step 4: Commit (nếu Step 2 có sửa file)**

```bash
git add -A
git commit -m "chore(integrations): fix lint issues in Zalo OA module"
```

(Bỏ qua nếu không có thay đổi.)

---

## Tổng kết phạm vi ngoài plan này

- Implement thật `EsmsGateway` (Vihat) — chỉ cần thêm class mới implement
  `IMessagingGateway`, đăng ký thêm vào mảng `MESSAGING_GATEWAYS` trong
  `integrations.module.ts` (Task 17, Step 4) — không cần sửa domain/application layer.
- Mã hoá `accessToken`/`refreshToken` tại rest.
- Webhook cho sự kiện `follow`/`unfollow` (hiện tại chỉ log, chưa lưu bảng riêng).
- Catalog mẫu ZNS.
