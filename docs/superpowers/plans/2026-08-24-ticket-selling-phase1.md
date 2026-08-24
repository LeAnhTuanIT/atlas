# Ticket Selling (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `ticket` module so a merchant can create ticket products (day-pass, session/hour-based, playground multi-use, concert zone-based) and sell them to customers online or at the counter, with oversell-safe quota handling.

**Architecture:** New NestJS module `src/modules/ticket/` following the repo's existing DDD layering (domain/application/infrastructure/presentation), same pattern as `payment`/`merchant`/`integrations`. Three aggregates: `TicketProduct` (catalog, owns `TicketZone`/`TicketSession` children), `TicketOrder` (purchase, owns `TicketOrderLine` children), `Ticket` (one row per issued physical ticket). Online payment reuses the existing `PaymentGatewayFactory`/`IPaymentGateway` abstraction from the `payment` module (Payos/VnPay/MoMo) directly — it does **not** reuse `payment`'s wallet-deposit-specific `PaymentOrder`/`ProcessPaymentWebhookHandler`, since those are hard-wired to top-up-wallet semantics that don't fit ticket purchases. Quota protection is two-layered: a Redis soft-hold (fast-fail, self-healing counter with TTL) at order-creation time, and a Postgres conditional `UPDATE ... WHERE quota >= :qty` inside a transaction at payment-confirmation time (the real source of truth).

**Tech Stack:** NestJS, TypeORM (Postgres, `synchronize: true` — no manual migrations needed), ioredis (`REDIS_CLIENT` token, global module), `@nestjs/schedule` (already registered globally via `ScheduleModule.forRoot()`), class-validator/class-transformer for DTOs, Jest for tests.

**Spec:** `docs/superpowers/specs/2026-08-24-ticket-selling-design.md`

## Global Constraints

- Domain `id` on every aggregate is a `crypto.randomUUID()` string generated at creation — this is the convention used by `merchant`, `integrations` (`ZbsTemplate`), etc. Do not use auto-increment ids as the domain id.
- ORM entities extend `BaseOrmEntity` (`src/shared/infrastructure/persistence/base.orm-entity.ts`), which provides an internal `bigint id` PK plus a separate unique `uuid` column. The domain aggregate id always maps to the ORM `uuid` column, never to the ORM `id` column.
- Repository `save()` methods must look up any existing row (aggregate root **and** any child rows, e.g. zones/sessions/lines) by `uuid` first and copy the existing `id` onto the object being saved — otherwise TypeORM inserts a duplicate row instead of updating. This mirrors `src/modules/integrations/infrastructure/persistence/repositories/typeorm-zbs-template.repository.ts` and `src/modules/payment/infrastructure/persistence/typeorm/payment-order.typeorm.repository.ts`.
- Money amounts are stored as `bigint` columns (smallest currency unit) with a `transformer` converting string↔number, matching `PaymentOrderOrmEntity.amount`.
- Application command handlers are plain `@Injectable()` classes with an `execute(cmd)` method, instantiated directly by controllers (`new SomeCommand(...)` then `handler.execute(cmd)`). There is no `@nestjs/cqrs` `CommandBus` in this codebase — do not introduce one.
- Controllers use `@Controller({ path: '...', version: '1' })` + `@UseGuards(MerchantAuthGuard | CustomerAuthGuard)` from `@/shared/infrastructure/auth/guards/auth-guards.guards`, matching `src/modules/integrations/presentation/http/zalo-oa.controller.ts`. `req.user` is typed via a local `AuthenticatedRequest extends Request { user: {...} }` interface.
- DTOs use `class-validator`/`class-transformer` decorators (global `ValidationPipe` is enabled in `main.ts`), matching `src/modules/integrations/application/dtos/create-zbs-template.dto.ts`.
- Cross-aggregate atomic writes (quota decrement + ticket issuance + order status) use `DataSource.transaction()` injected directly into the handler, matching `src/modules/wallet/infrastructure/persistence/typeorm/wallet.typeorm.repository.ts`.
- All test descriptions and error messages are in Vietnamese, matching every existing `.spec.ts` in the repo.
- Out of scope for this plan (Phase 2, per spec §6): QR check-in/redemption engine, `remainingUses` decrementing, refund execution logic (only the trigger point exists).

---

### Task 1: Module scaffold, enums, and value objects

**Files:**
- Create: `src/modules/ticket/ticket.module.ts` (empty shell for now, filled in later tasks)
- Create: `src/modules/ticket/domain/value-objects/ticket-enums.vo.ts`
- Test: none (pure type/enum declarations, covered indirectly by later tests)

**Interfaces:**
- Produces: `TicketProductStatusEnum`, `TicketValidityTypeEnum`, `TicketUsageTypeEnum`, `TicketUsageRule`, `TicketOrderChannelEnum`, `TicketOrderStatusEnum`, `TicketStatusEnum` — used by every subsequent task.

- [ ] **Step 1: Create the enums/value-objects file**

```typescript
// src/modules/ticket/domain/value-objects/ticket-enums.vo.ts

export enum TicketProductStatusEnum {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum TicketValidityTypeEnum {
  DAY_PASS = 'DAY_PASS',
  SESSION = 'SESSION',
}

export enum TicketUsageTypeEnum {
  UNLIMITED_USE = 'UNLIMITED_USE',
  LIMITED_USE = 'LIMITED_USE',
}

export interface TicketUsageRule {
  type: TicketUsageTypeEnum;
  // Bắt buộc phải có giá trị > 0 khi type = LIMITED_USE, bỏ trống khi UNLIMITED_USE.
  maxUses?: number;
}

export enum TicketOrderChannelEnum {
  ONLINE = 'ONLINE',
  COUNTER = 'COUNTER',
}

export enum TicketOrderStatusEnum {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum TicketStatusEnum {
  ISSUED = 'ISSUED',
  CANCELLED = 'CANCELLED',
}
```

- [ ] **Step 2: Create the empty module shell**

```typescript
// src/modules/ticket/ticket.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class TicketModule {}
```

- [ ] **Step 3: Verify the project still compiles**

Run: `bun run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/ticket/ticket.module.ts src/modules/ticket/domain/value-objects/ticket-enums.vo.ts
git commit -m "feat(ticket): scaffold ticket module and shared enums"
```

---

### Task 2: Domain — `TicketProduct` aggregate (with `TicketZone`/`TicketSession`)

**Files:**
- Create: `src/modules/ticket/domain/models/ticket-zone.entity.ts`
- Create: `src/modules/ticket/domain/models/ticket-session.entity.ts`
- Create: `src/modules/ticket/domain/models/ticket-product.aggregate.ts`
- Test: `src/modules/ticket/domain/models/ticket-product.aggregate.spec.ts`

**Interfaces:**
- Consumes: enums from Task 1 (`TicketProductStatusEnum`, `TicketValidityTypeEnum`, `TicketUsageTypeEnum`, `TicketUsageRule`).
- Produces: `TicketZone` (`getId()`, `getName()`, `getQuota()`), `TicketSession` (`getId()`, `getStartAt()`, `getEndAt()`, `isActiveAt(now: Date)`), `TicketProduct` (`static create(params)`, `publish()`, `isPublished()`, `findZone(zoneId)`, `findSession(sessionId)`, getters listed below, plus the full constructor signature — later tasks (mapper) construct `TicketProduct` directly via `new TicketProduct(...)`).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/modules/ticket/domain/models/ticket-product.aggregate.spec.ts
import { TicketProduct } from './ticket-product.aggregate';
import {
  TicketProductStatusEnum,
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '../value-objects/ticket-enums.vo';

function buildValidParams(overrides: Partial<Parameters<typeof TicketProduct.create>[0]> = {}) {
  return {
    merchantId: 'merchant-1',
    name: 'Vé khu vui chơi',
    description: 'Vé vào cổng khu vui chơi',
    priceAmount: 100000,
    priceCurrency: 'VND',
    validityType: TicketValidityTypeEnum.DAY_PASS,
    usageRule: { type: TicketUsageTypeEnum.UNLIMITED_USE },
    zones: [{ name: 'DEFAULT', quota: 100 }],
    sessions: [
      { startAt: new Date('2026-09-01T00:00:00Z'), endAt: new Date('2026-09-01T23:59:59Z') },
    ],
    ...overrides,
  };
}

describe('TicketProduct', () => {
  it('tạo mới ở trạng thái DRAFT với zone/session hợp lệ', () => {
    const product = TicketProduct.create(buildValidParams());

    expect(product.getStatus()).toBe(TicketProductStatusEnum.DRAFT);
    expect(product.getZones()).toHaveLength(1);
    expect(product.getZones()[0].getQuota()).toBe(100);
    expect(product.getSessions()).toHaveLength(1);
    expect(product.isPublished()).toBe(false);
  });

  it('ném lỗi khi không có zone nào', () => {
    expect(() => TicketProduct.create(buildValidParams({ zones: [] }))).toThrow(
      'Loại vé phải có ít nhất 1 zone',
    );
  });

  it('ném lỗi khi quota zone <= 0', () => {
    expect(() =>
      TicketProduct.create(buildValidParams({ zones: [{ name: 'VIP', quota: 0 }] })),
    ).toThrow('Quota của zone phải lớn hơn 0');
  });

  it('ném lỗi khi không có session nào', () => {
    expect(() => TicketProduct.create(buildValidParams({ sessions: [] }))).toThrow(
      'Loại vé phải có ít nhất 1 session hiệu lực',
    );
  });

  it('ném lỗi khi giá vé âm', () => {
    expect(() => TicketProduct.create(buildValidParams({ priceAmount: -1 }))).toThrow(
      'Giá vé không được âm',
    );
  });

  it('ném lỗi khi LIMITED_USE không có maxUses hợp lệ', () => {
    expect(() =>
      TicketProduct.create(
        buildValidParams({ usageRule: { type: TicketUsageTypeEnum.LIMITED_USE } }),
      ),
    ).toThrow('LIMITED_USE phải có maxUses > 0');
  });

  it('publish() chuyển DRAFT -> PUBLISHED', () => {
    const product = TicketProduct.create(buildValidParams());
    product.publish();
    expect(product.getStatus()).toBe(TicketProductStatusEnum.PUBLISHED);
    expect(product.isPublished()).toBe(true);
  });

  it('publish() ném lỗi khi không ở trạng thái DRAFT', () => {
    const product = TicketProduct.create(buildValidParams());
    product.publish();
    expect(() => product.publish()).toThrow(
      'Không thể publish loại vé đang ở trạng thái PUBLISHED',
    );
  });

  it('findZone()/findSession() trả về đúng entity theo id, undefined nếu không có', () => {
    const product = TicketProduct.create(buildValidParams());
    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    expect(product.findZone(zoneId)?.getId()).toBe(zoneId);
    expect(product.findSession(sessionId)?.getId()).toBe(sessionId);
    expect(product.findZone('khong-ton-tai')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/modules/ticket/domain/models/ticket-product.aggregate.spec.ts`
Expected: FAIL — `Cannot find module './ticket-product.aggregate'`

- [ ] **Step 3: Implement `TicketZone`**

```typescript
// src/modules/ticket/domain/models/ticket-zone.entity.ts

export interface TicketZoneProps {
  id?: string;
  name: string;
  quota: number;
}

export class TicketZone {
  readonly id: string;
  private name: string;
  private quota: number;

  constructor(props: TicketZoneProps) {
    this.id = props.id ?? crypto.randomUUID();
    this.name = props.name;
    this.quota = props.quota;
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getQuota(): number {
    return this.quota;
  }
}
```

- [ ] **Step 4: Implement `TicketSession`**

```typescript
// src/modules/ticket/domain/models/ticket-session.entity.ts

export interface TicketSessionProps {
  id?: string;
  startAt: Date;
  endAt: Date;
}

export class TicketSession {
  readonly id: string;
  private startAt: Date;
  private endAt: Date;

  constructor(props: TicketSessionProps) {
    if (props.endAt <= props.startAt) {
      throw new Error('Thời điểm kết thúc session phải sau thời điểm bắt đầu');
    }
    this.id = props.id ?? crypto.randomUUID();
    this.startAt = props.startAt;
    this.endAt = props.endAt;
  }

  getId(): string {
    return this.id;
  }

  getStartAt(): Date {
    return this.startAt;
  }

  getEndAt(): Date {
    return this.endAt;
  }

  isActiveAt(now: Date): boolean {
    return now <= this.endAt;
  }
}
```

- [ ] **Step 5: Implement `TicketProduct`**

```typescript
// src/modules/ticket/domain/models/ticket-product.aggregate.ts
import { BaseEntity } from '@/shared/domain/base.entity';
import { TicketZone, TicketZoneProps } from './ticket-zone.entity';
import { TicketSession, TicketSessionProps } from './ticket-session.entity';
import {
  TicketProductStatusEnum,
  TicketUsageRule,
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '../value-objects/ticket-enums.vo';

export interface CreateTicketProductParams {
  merchantId: string;
  name: string;
  description?: string;
  priceAmount: number;
  priceCurrency: string;
  validityType: TicketValidityTypeEnum;
  usageRule: TicketUsageRule;
  zones: Array<{ name: string; quota: number }>;
  sessions: Array<{ startAt: Date; endAt: Date }>;
}

export class TicketProduct extends BaseEntity<string> {
  constructor(
    id: string,
    private readonly merchantId: string,
    private name: string,
    private description: string | undefined,
    private priceAmount: number,
    private priceCurrency: string,
    private readonly validityType: TicketValidityTypeEnum,
    private readonly usageRule: TicketUsageRule,
    private zones: TicketZone[],
    private sessions: TicketSession[],
    private status: TicketProductStatusEnum,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(params: CreateTicketProductParams): TicketProduct {
    if (params.priceAmount < 0) {
      throw new Error('Giá vé không được âm');
    }
    if (!params.zones.length) {
      throw new Error('Loại vé phải có ít nhất 1 zone');
    }
    if (params.zones.some((z) => z.quota <= 0)) {
      throw new Error('Quota của zone phải lớn hơn 0');
    }
    if (!params.sessions.length) {
      throw new Error('Loại vé phải có ít nhất 1 session hiệu lực');
    }
    if (
      params.usageRule.type === TicketUsageTypeEnum.LIMITED_USE &&
      (!params.usageRule.maxUses || params.usageRule.maxUses <= 0)
    ) {
      throw new Error('LIMITED_USE phải có maxUses > 0');
    }

    return new TicketProduct(
      crypto.randomUUID(),
      params.merchantId,
      params.name,
      params.description,
      params.priceAmount,
      params.priceCurrency,
      params.validityType,
      params.usageRule,
      params.zones.map((z: TicketZoneProps) => new TicketZone(z)),
      params.sessions.map((s: TicketSessionProps) => new TicketSession(s)),
      TicketProductStatusEnum.DRAFT,
    );
  }

  publish(): void {
    if (this.status !== TicketProductStatusEnum.DRAFT) {
      throw new Error(`Không thể publish loại vé đang ở trạng thái ${this.status}`);
    }
    this.status = TicketProductStatusEnum.PUBLISHED;
    this._updatedAt = new Date();
  }

  isPublished(): boolean {
    return this.status === TicketProductStatusEnum.PUBLISHED;
  }

  findZone(zoneId: string): TicketZone | undefined {
    return this.zones.find((z) => z.getId() === zoneId);
  }

  findSession(sessionId: string): TicketSession | undefined {
    return this.sessions.find((s) => s.getId() === sessionId);
  }

  getMerchantId(): string {
    return this.merchantId;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getPriceAmount(): number {
    return this.priceAmount;
  }

  getPriceCurrency(): string {
    return this.priceCurrency;
  }

  getValidityType(): TicketValidityTypeEnum {
    return this.validityType;
  }

  getUsageRule(): TicketUsageRule {
    return this.usageRule;
  }

  getZones(): TicketZone[] {
    return this.zones;
  }

  getSessions(): TicketSession[] {
    return this.sessions;
  }

  getStatus(): TicketProductStatusEnum {
    return this.status;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test src/modules/ticket/domain/models/ticket-product.aggregate.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 7: Commit**

```bash
git add src/modules/ticket/domain/models/ticket-zone.entity.ts src/modules/ticket/domain/models/ticket-session.entity.ts src/modules/ticket/domain/models/ticket-product.aggregate.ts src/modules/ticket/domain/models/ticket-product.aggregate.spec.ts
git commit -m "feat(ticket): add TicketProduct aggregate with zones and sessions"
```

---

### Task 3: Domain — `TicketOrder` aggregate (with `TicketOrderLine`)

**Files:**
- Create: `src/modules/ticket/domain/models/ticket-order-line.entity.ts`
- Create: `src/modules/ticket/domain/models/ticket-order.aggregate.ts`
- Test: `src/modules/ticket/domain/models/ticket-order.aggregate.spec.ts`

**Interfaces:**
- Consumes: `TicketOrderChannelEnum`, `TicketOrderStatusEnum` from Task 1.
- Produces: `TicketOrderLine` (`getId()`, `getTicketProductId()`, `getTicketSessionId()`, `getZoneId()`, `getQuantity()`, `getUnitPrice()`, `getTotalAmount()`), `TicketOrder` (`static create(params)`, `attachPaymentOrderCode(code)`, `markAsPaid()`, `markAsCancelled()`, `markAsExpired()`, `cancelPaidOrder()`, `isPending()`, getters below). These are consumed directly by Tasks 6, 10, 11, 12.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/modules/ticket/domain/models/ticket-order.aggregate.spec.ts
import { TicketOrder } from './ticket-order.aggregate';
import { TicketOrderChannelEnum, TicketOrderStatusEnum } from '../value-objects/ticket-enums.vo';

function buildLine(overrides: Partial<{ quantity: number }> = {}) {
  return {
    ticketProductId: 'product-1',
    ticketSessionId: 'session-1',
    zoneId: 'zone-1',
    quantity: overrides.quantity ?? 2,
    unitPrice: 100000,
  };
}

describe('TicketOrder', () => {
  it('tạo đơn ONLINE hợp lệ ở trạng thái PENDING', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.ONLINE,
      buyerId: 'customer-1',
      lines: [buildLine()],
    });

    expect(order.getStatus()).toBe(TicketOrderStatusEnum.PENDING);
    expect(order.getChannel()).toBe(TicketOrderChannelEnum.ONLINE);
    expect(order.getTotalAmount()).toBe(200000);
    expect(order.isPending()).toBe(true);
  });

  it('ném lỗi khi đơn ONLINE không có buyerId', () => {
    expect(() =>
      TicketOrder.create({
        merchantId: 'merchant-1',
        channel: TicketOrderChannelEnum.ONLINE,
        lines: [buildLine()],
      }),
    ).toThrow('Đơn vé online phải có buyerId');
  });

  it('tạo đơn COUNTER hợp lệ không cần buyerId', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    expect(order.getBuyerId()).toBeUndefined();
  });

  it('ném lỗi khi không có dòng vé nào', () => {
    expect(() =>
      TicketOrder.create({
        merchantId: 'merchant-1',
        channel: TicketOrderChannelEnum.COUNTER,
        lines: [],
      }),
    ).toThrow('Đơn vé phải có ít nhất 1 dòng vé');
  });

  it('ném lỗi khi số lượng dòng vé <= 0', () => {
    expect(() =>
      TicketOrder.create({
        merchantId: 'merchant-1',
        channel: TicketOrderChannelEnum.COUNTER,
        lines: [buildLine({ quantity: 0 })],
      }),
    ).toThrow('Số lượng vé phải lớn hơn 0');
  });

  it('markAsPaid() chuyển PENDING -> PAID, idempotent nếu gọi lại', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    order.markAsPaid();
    expect(order.getStatus()).toBe(TicketOrderStatusEnum.PAID);
    expect(() => order.markAsPaid()).not.toThrow();
  });

  it('markAsCancelled() ném lỗi nếu đơn đã PAID', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    order.markAsPaid();
    expect(() => order.markAsCancelled()).toThrow(
      'Không thể huỷ đơn đã thanh toán qua markAsCancelled, dùng luồng hoàn tiền riêng',
    );
  });

  it('markAsExpired() chỉ có hiệu lực khi đang PENDING', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    order.markAsPaid();
    order.markAsExpired();
    expect(order.getStatus()).toBe(TicketOrderStatusEnum.PAID);
  });

  it('cancelPaidOrder() chuyển PAID -> CANCELLED, ném lỗi nếu chưa PAID', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [buildLine()],
    });
    expect(() => order.cancelPaidOrder()).toThrow(
      'Chỉ có thể huỷ đơn đã PAID bằng phương thức này',
    );
    order.markAsPaid();
    order.cancelPaidOrder();
    expect(order.getStatus()).toBe(TicketOrderStatusEnum.CANCELLED);
  });

  it('attachPaymentOrderCode() lưu mã liên kết gateway thanh toán', () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.ONLINE,
      buyerId: 'customer-1',
      lines: [buildLine()],
    });
    order.attachPaymentOrderCode(order.id);
    expect(order.getPaymentOrderCode()).toBe(order.id);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/modules/ticket/domain/models/ticket-order.aggregate.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `TicketOrderLine`**

```typescript
// src/modules/ticket/domain/models/ticket-order-line.entity.ts

export interface TicketOrderLineProps {
  id?: string;
  ticketProductId: string;
  ticketSessionId: string;
  zoneId: string;
  quantity: number;
  unitPrice: number;
}

export class TicketOrderLine {
  readonly id: string;
  readonly ticketProductId: string;
  readonly ticketSessionId: string;
  readonly zoneId: string;
  readonly quantity: number;
  readonly unitPrice: number;

  constructor(props: TicketOrderLineProps) {
    if (props.quantity <= 0) {
      throw new Error('Số lượng vé phải lớn hơn 0');
    }
    this.id = props.id ?? crypto.randomUUID();
    this.ticketProductId = props.ticketProductId;
    this.ticketSessionId = props.ticketSessionId;
    this.zoneId = props.zoneId;
    this.quantity = props.quantity;
    this.unitPrice = props.unitPrice;
  }

  getId(): string {
    return this.id;
  }

  getTicketProductId(): string {
    return this.ticketProductId;
  }

  getTicketSessionId(): string {
    return this.ticketSessionId;
  }

  getZoneId(): string {
    return this.zoneId;
  }

  getQuantity(): number {
    return this.quantity;
  }

  getUnitPrice(): number {
    return this.unitPrice;
  }

  getTotalAmount(): number {
    return this.quantity * this.unitPrice;
  }
}
```

- [ ] **Step 4: Implement `TicketOrder`**

```typescript
// src/modules/ticket/domain/models/ticket-order.aggregate.ts
import { BaseEntity } from '@/shared/domain/base.entity';
import { TicketOrderLine, TicketOrderLineProps } from './ticket-order-line.entity';
import { TicketOrderChannelEnum, TicketOrderStatusEnum } from '../value-objects/ticket-enums.vo';

export interface CreateTicketOrderParams {
  merchantId: string;
  channel: TicketOrderChannelEnum;
  buyerId?: string;
  lines: Omit<TicketOrderLineProps, 'id'>[];
}

export class TicketOrder extends BaseEntity<string> {
  constructor(
    id: string,
    private readonly merchantId: string,
    private readonly channel: TicketOrderChannelEnum,
    private readonly buyerId: string | undefined,
    private lines: TicketOrderLine[],
    private status: TicketOrderStatusEnum,
    private paymentOrderCode: string | undefined,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static create(params: CreateTicketOrderParams): TicketOrder {
    if (!params.lines.length) {
      throw new Error('Đơn vé phải có ít nhất 1 dòng vé');
    }
    if (params.channel === TicketOrderChannelEnum.ONLINE && !params.buyerId) {
      throw new Error('Đơn vé online phải có buyerId');
    }
    return new TicketOrder(
      crypto.randomUUID(),
      params.merchantId,
      params.channel,
      params.buyerId,
      params.lines.map((l) => new TicketOrderLine(l)),
      TicketOrderStatusEnum.PENDING,
      undefined,
    );
  }

  attachPaymentOrderCode(code: string): void {
    this.paymentOrderCode = code;
    this._updatedAt = new Date();
  }

  markAsPaid(): void {
    if (this.status === TicketOrderStatusEnum.PAID) {
      return;
    }
    if (this.status !== TicketOrderStatusEnum.PENDING) {
      throw new Error(`Không thể đánh dấu PAID cho đơn ở trạng thái ${this.status}`);
    }
    this.status = TicketOrderStatusEnum.PAID;
    this._updatedAt = new Date();
  }

  markAsCancelled(): void {
    if (this.status === TicketOrderStatusEnum.CANCELLED) {
      return;
    }
    if (this.status === TicketOrderStatusEnum.PAID) {
      throw new Error(
        'Không thể huỷ đơn đã thanh toán qua markAsCancelled, dùng luồng hoàn tiền riêng',
      );
    }
    this.status = TicketOrderStatusEnum.CANCELLED;
    this._updatedAt = new Date();
  }

  markAsExpired(): void {
    if (this.status !== TicketOrderStatusEnum.PENDING) {
      return;
    }
    this.status = TicketOrderStatusEnum.EXPIRED;
    this._updatedAt = new Date();
  }

  cancelPaidOrder(): void {
    if (this.status !== TicketOrderStatusEnum.PAID) {
      throw new Error('Chỉ có thể huỷ đơn đã PAID bằng phương thức này');
    }
    this.status = TicketOrderStatusEnum.CANCELLED;
    this._updatedAt = new Date();
  }

  isPending(): boolean {
    return this.status === TicketOrderStatusEnum.PENDING;
  }

  getMerchantId(): string {
    return this.merchantId;
  }

  getChannel(): TicketOrderChannelEnum {
    return this.channel;
  }

  getBuyerId(): string | undefined {
    return this.buyerId;
  }

  getLines(): TicketOrderLine[] {
    return this.lines;
  }

  getStatus(): TicketOrderStatusEnum {
    return this.status;
  }

  getPaymentOrderCode(): string | undefined {
    return this.paymentOrderCode;
  }

  getTotalAmount(): number {
    return this.lines.reduce((sum, l) => sum + l.getTotalAmount(), 0);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/modules/ticket/domain/models/ticket-order.aggregate.spec.ts`
Expected: PASS (9 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/ticket/domain/models/ticket-order-line.entity.ts src/modules/ticket/domain/models/ticket-order.aggregate.ts src/modules/ticket/domain/models/ticket-order.aggregate.spec.ts
git commit -m "feat(ticket): add TicketOrder aggregate with order lines"
```

---

### Task 4: Domain — `Ticket` aggregate

**Files:**
- Create: `src/modules/ticket/domain/models/ticket.aggregate.ts`
- Test: `src/modules/ticket/domain/models/ticket.aggregate.spec.ts`

**Interfaces:**
- Consumes: `TicketStatusEnum` from Task 1.
- Produces: `Ticket` (`static issue(params)`, `cancel()`, `getCode()`, `getTicketOrderId()`, `getTicketProductId()`, `getTicketSessionId()`, `getZoneId()`, `getStatus()`, `getRemainingUses()`) — consumed by Task 7 (persistence) and Task 11 (confirm handler).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/modules/ticket/domain/models/ticket.aggregate.spec.ts
import { Ticket } from './ticket.aggregate';
import { TicketStatusEnum } from '../value-objects/ticket-enums.vo';

describe('Ticket', () => {
  it('issue() tạo vé ISSUED với code duy nhất bắt đầu bằng TKT-', () => {
    const ticket = Ticket.issue({
      ticketOrderId: 'order-1',
      ticketProductId: 'product-1',
      ticketSessionId: 'session-1',
      zoneId: 'zone-1',
      remainingUses: null,
    });

    expect(ticket.getStatus()).toBe(TicketStatusEnum.ISSUED);
    expect(ticket.getCode()).toMatch(/^TKT-[A-Z0-9]{12}$/);
    expect(ticket.getRemainingUses()).toBeNull();
  });

  it('issue() hai lần cho ra hai code khác nhau', () => {
    const params = {
      ticketOrderId: 'order-1',
      ticketProductId: 'product-1',
      ticketSessionId: 'session-1',
      zoneId: 'zone-1',
      remainingUses: 5,
    };
    const a = Ticket.issue(params);
    const b = Ticket.issue(params);
    expect(a.getCode()).not.toBe(b.getCode());
    expect(a.getRemainingUses()).toBe(5);
  });

  it('cancel() chuyển ISSUED -> CANCELLED, idempotent nếu gọi lại', () => {
    const ticket = Ticket.issue({
      ticketOrderId: 'order-1',
      ticketProductId: 'product-1',
      ticketSessionId: 'session-1',
      zoneId: 'zone-1',
      remainingUses: null,
    });
    ticket.cancel();
    expect(ticket.getStatus()).toBe(TicketStatusEnum.CANCELLED);
    expect(() => ticket.cancel()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/modules/ticket/domain/models/ticket.aggregate.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `Ticket`**

```typescript
// src/modules/ticket/domain/models/ticket.aggregate.ts
import { BaseEntity } from '@/shared/domain/base.entity';
import { TicketStatusEnum } from '../value-objects/ticket-enums.vo';

export interface IssueTicketParams {
  ticketOrderId: string;
  ticketProductId: string;
  ticketSessionId: string;
  zoneId: string;
  // null = unlimited-use; số nguyên dương = số lượt còn lại (dùng ở Giai đoạn 2).
  remainingUses: number | null;
}

export class Ticket extends BaseEntity<string> {
  constructor(
    id: string,
    private readonly code: string,
    private readonly ticketOrderId: string,
    private readonly ticketProductId: string,
    private readonly ticketSessionId: string,
    private readonly zoneId: string,
    private status: TicketStatusEnum,
    private remainingUses: number | null,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super(id, createdAt, updatedAt);
  }

  static issue(params: IssueTicketParams): Ticket {
    return new Ticket(
      crypto.randomUUID(),
      Ticket.generateCode(),
      params.ticketOrderId,
      params.ticketProductId,
      params.ticketSessionId,
      params.zoneId,
      TicketStatusEnum.ISSUED,
      params.remainingUses,
    );
  }

  private static generateCode(): string {
    return `TKT-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
  }

  cancel(): void {
    if (this.status === TicketStatusEnum.CANCELLED) {
      return;
    }
    this.status = TicketStatusEnum.CANCELLED;
    this._updatedAt = new Date();
  }

  getCode(): string {
    return this.code;
  }

  getTicketOrderId(): string {
    return this.ticketOrderId;
  }

  getTicketProductId(): string {
    return this.ticketProductId;
  }

  getTicketSessionId(): string {
    return this.ticketSessionId;
  }

  getZoneId(): string {
    return this.zoneId;
  }

  getStatus(): TicketStatusEnum {
    return this.status;
  }

  getRemainingUses(): number | null {
    return this.remainingUses;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/modules/ticket/domain/models/ticket.aggregate.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/ticket/domain/models/ticket.aggregate.ts src/modules/ticket/domain/models/ticket.aggregate.spec.ts
git commit -m "feat(ticket): add Ticket aggregate"
```

---

### Task 5: Persistence — `TicketProduct` (ORM entities, mapper, repository)

**Files:**
- Create: `src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-zone.orm-entity.ts`
- Create: `src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-session.orm-entity.ts`
- Create: `src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-product.orm-entity.ts`
- Create: `src/modules/ticket/infrastructure/persistence/mappers/ticket-product.mapper.ts`
- Create: `src/modules/ticket/domain/repositories/ticket-product.repository.interface.ts`
- Create: `src/modules/ticket/infrastructure/persistence/typeorm/ticket-product.typeorm.repository.ts`
- Test: `src/modules/ticket/infrastructure/persistence/mappers/ticket-product.mapper.spec.ts`

**Interfaces:**
- Consumes: `TicketProduct`/`TicketZone`/`TicketSession` (Task 2).
- Produces: `ITicketProductRepository { findById(id): Promise<TicketProduct | null>; findPublishedById(id): Promise<TicketProduct | null>; save(product): Promise<void>; }`, `TICKET_PRODUCT_REPOSITORY` symbol — consumed by Task 9 (create/publish handlers) and Task 10 (create order handler).

- [ ] **Step 1: Write the failing mapper test**

```typescript
// src/modules/ticket/infrastructure/persistence/mappers/ticket-product.mapper.spec.ts
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import {
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketProductMapper } from './ticket-product.mapper';

describe('TicketProductMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu, bao gồm zones và sessions', () => {
    const domain = TicketProduct.create({
      merchantId: 'merchant-1',
      name: 'Vé zone concert',
      description: 'Zone VIP + Zone thường',
      priceAmount: 500000,
      priceCurrency: 'VND',
      validityType: TicketValidityTypeEnum.SESSION,
      usageRule: { type: TicketUsageTypeEnum.UNLIMITED_USE },
      zones: [
        { name: 'VIP', quota: 200 },
        { name: 'Thường', quota: 1000 },
      ],
      sessions: [
        { startAt: new Date('2026-09-01T14:00:00Z'), endAt: new Date('2026-09-01T16:00:00Z') },
      ],
    });

    const orm = TicketProductMapper.toOrm(domain);
    orm.id = '1';
    orm.zones.forEach((z, i) => (z.id = String(i + 1)));
    orm.sessions.forEach((s, i) => (s.id = String(i + 1)));

    expect(orm.uuid).toBe(domain.id);
    expect(orm.zones).toHaveLength(2);
    expect(orm.zones[0].quota).toBe(200);
    expect(orm.sessions).toHaveLength(1);

    const roundTripped = TicketProductMapper.toDomain(orm);
    expect(roundTripped.id).toBe(domain.id);
    expect(roundTripped.getName()).toBe('Vé zone concert');
    expect(roundTripped.getPriceAmount()).toBe(500000);
    expect(roundTripped.getZones().map((z) => z.getName())).toEqual(['VIP', 'Thường']);
    expect(roundTripped.getSessions()).toHaveLength(1);
    expect(roundTripped.getStatus()).toBe(domain.getStatus());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/modules/ticket/infrastructure/persistence/mappers/ticket-product.mapper.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the ORM entities**

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-zone.orm-entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { TicketProductOrmEntity } from './ticket-product.orm-entity';

@Entity({ name: 'ticket_zones' })
export class TicketZoneOrmEntity extends BaseOrmEntity {
  @Column({ name: 'ticket_product_id', type: 'uuid' })
  ticketProductId: string;

  @ManyToOne(() => TicketProductOrmEntity, (p) => p.zones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_product_id', referencedColumnName: 'uuid' })
  ticketProduct?: TicketProductOrmEntity;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'int' })
  quota: number;
}
```

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-session.orm-entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { TicketProductOrmEntity } from './ticket-product.orm-entity';

@Entity({ name: 'ticket_sessions' })
export class TicketSessionOrmEntity extends BaseOrmEntity {
  @Column({ name: 'ticket_product_id', type: 'uuid' })
  ticketProductId: string;

  @ManyToOne(() => TicketProductOrmEntity, (p) => p.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_product_id', referencedColumnName: 'uuid' })
  ticketProduct?: TicketProductOrmEntity;

  @Column({ name: 'start_at', type: 'timestamptz' })
  startAt: Date;

  @Column({ name: 'end_at', type: 'timestamptz' })
  endAt: Date;
}
```

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-product.orm-entity.ts
import { Entity, Column, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { TicketZoneOrmEntity } from './ticket-zone.orm-entity';
import { TicketSessionOrmEntity } from './ticket-session.orm-entity';

@Entity({ name: 'ticket_products' })
export class TicketProductOrmEntity extends BaseOrmEntity {
  @Index()
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => MerchantOrmEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'merchant_id', referencedColumnName: 'uuid' })
  merchant?: MerchantOrmEntity;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'price_amount',
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  priceAmount: number;

  @Column({ name: 'price_currency', type: 'varchar', length: 3, default: 'VND' })
  priceCurrency: string;

  @Column({ name: 'validity_type', type: 'varchar', length: 20 })
  validityType: string;

  @Column({ name: 'usage_type', type: 'varchar', length: 20 })
  usageType: string;

  @Column({ name: 'usage_max_uses', type: 'int', nullable: true })
  usageMaxUses: number | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string;

  @OneToMany(() => TicketZoneOrmEntity, (z) => z.ticketProduct, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  zones: TicketZoneOrmEntity[];

  @OneToMany(() => TicketSessionOrmEntity, (s) => s.ticketProduct, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  sessions: TicketSessionOrmEntity[];
}
```

- [ ] **Step 4: Create the mapper**

```typescript
// src/modules/ticket/infrastructure/persistence/mappers/ticket-product.mapper.ts
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import { TicketZone } from '@/modules/ticket/domain/models/ticket-zone.entity';
import { TicketSession } from '@/modules/ticket/domain/models/ticket-session.entity';
import {
  TicketProductStatusEnum,
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketProductOrmEntity } from '../typeorm/entities/ticket-product.orm-entity';
import { TicketZoneOrmEntity } from '../typeorm/entities/ticket-zone.orm-entity';
import { TicketSessionOrmEntity } from '../typeorm/entities/ticket-session.orm-entity';

export class TicketProductMapper {
  static toDomain(orm: TicketProductOrmEntity): TicketProduct {
    return new TicketProduct(
      orm.uuid,
      orm.merchantId,
      orm.name,
      orm.description ?? undefined,
      orm.priceAmount,
      orm.priceCurrency,
      orm.validityType as TicketValidityTypeEnum,
      {
        type: orm.usageType as TicketUsageTypeEnum,
        maxUses: orm.usageMaxUses ?? undefined,
      },
      (orm.zones ?? []).map(
        (z) => new TicketZone({ id: z.uuid, name: z.name, quota: z.quota }),
      ),
      (orm.sessions ?? []).map(
        (s) => new TicketSession({ id: s.uuid, startAt: s.startAt, endAt: s.endAt }),
      ),
      orm.status as TicketProductStatusEnum,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: TicketProduct): TicketProductOrmEntity {
    const orm = new TicketProductOrmEntity();
    orm.uuid = domain.id;
    orm.merchantId = domain.getMerchantId();
    orm.name = domain.getName();
    orm.description = domain.getDescription() ?? null;
    orm.priceAmount = domain.getPriceAmount();
    orm.priceCurrency = domain.getPriceCurrency();
    orm.validityType = domain.getValidityType();
    orm.usageType = domain.getUsageRule().type;
    orm.usageMaxUses = domain.getUsageRule().maxUses ?? null;
    orm.status = domain.getStatus();
    orm.zones = domain.getZones().map((z) => {
      const zoneOrm = new TicketZoneOrmEntity();
      zoneOrm.uuid = z.getId();
      zoneOrm.name = z.getName();
      zoneOrm.quota = z.getQuota();
      return zoneOrm;
    });
    orm.sessions = domain.getSessions().map((s) => {
      const sessionOrm = new TicketSessionOrmEntity();
      sessionOrm.uuid = s.getId();
      sessionOrm.startAt = s.getStartAt();
      sessionOrm.endAt = s.getEndAt();
      return sessionOrm;
    });
    return orm;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/modules/ticket/infrastructure/persistence/mappers/ticket-product.mapper.spec.ts`
Expected: PASS

- [ ] **Step 6: Create the repository interface**

```typescript
// src/modules/ticket/domain/repositories/ticket-product.repository.interface.ts
import type { TicketProduct } from '../models/ticket-product.aggregate';

export interface ITicketProductRepository {
  findById(id: string): Promise<TicketProduct | null>;
  findPublishedById(id: string): Promise<TicketProduct | null>;
  save(product: TicketProduct): Promise<void>;
}

export const TICKET_PRODUCT_REPOSITORY = Symbol('ITicketProductRepository');
```

- [ ] **Step 7: Create the TypeORM repository**

Copying existing zones/sessions bigint ids before save is required — otherwise TypeORM's cascade re-inserts every child row on every update instead of updating in place.

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/ticket-product.typeorm.repository.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { ITicketProductRepository } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import { TicketProductStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketProductOrmEntity } from './entities/ticket-product.orm-entity';
import { TicketProductMapper } from '../mappers/ticket-product.mapper';

@Injectable()
export class TicketProductTypeormRepository implements ITicketProductRepository {
  constructor(
    @InjectRepository(TicketProductOrmEntity)
    private readonly repo: Repository<TicketProductOrmEntity>,
  ) {}

  async findById(id: string): Promise<TicketProduct | null> {
    const orm = await this.repo.findOne({
      where: { uuid: id },
      relations: ['zones', 'sessions'],
    });
    return orm ? TicketProductMapper.toDomain(orm) : null;
  }

  async findPublishedById(id: string): Promise<TicketProduct | null> {
    const orm = await this.repo.findOne({
      where: { uuid: id, status: TicketProductStatusEnum.PUBLISHED },
      relations: ['zones', 'sessions'],
    });
    return orm ? TicketProductMapper.toDomain(orm) : null;
  }

  async save(product: TicketProduct): Promise<void> {
    const orm = TicketProductMapper.toOrm(product);

    const existing = await this.repo.findOne({
      where: { uuid: orm.uuid },
      relations: ['zones', 'sessions'],
    });
    if (existing) {
      orm.id = existing.id;
      for (const zoneOrm of orm.zones) {
        const existingZone = existing.zones.find((z) => z.uuid === zoneOrm.uuid);
        if (existingZone) {
          zoneOrm.id = existingZone.id;
        }
      }
      for (const sessionOrm of orm.sessions) {
        const existingSession = existing.sessions.find((s) => s.uuid === sessionOrm.uuid);
        if (existingSession) {
          sessionOrm.id = existingSession.id;
        }
      }
    }

    await this.repo.save(orm);
  }
}
```

- [ ] **Step 8: Verify the project compiles**

Run: `bun run build`
Expected: succeeds

- [ ] **Step 9: Commit**

```bash
git add src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-zone.orm-entity.ts src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-session.orm-entity.ts src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-product.orm-entity.ts src/modules/ticket/infrastructure/persistence/mappers/ticket-product.mapper.ts src/modules/ticket/infrastructure/persistence/mappers/ticket-product.mapper.spec.ts src/modules/ticket/domain/repositories/ticket-product.repository.interface.ts src/modules/ticket/infrastructure/persistence/typeorm/ticket-product.typeorm.repository.ts
git commit -m "feat(ticket): add TicketProduct persistence (orm entities, mapper, repository)"
```

---

### Task 6: Persistence — `TicketOrder` (ORM entities, mapper, repository)

**Files:**
- Create: `src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order-line.orm-entity.ts`
- Create: `src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order.orm-entity.ts`
- Create: `src/modules/ticket/infrastructure/persistence/mappers/ticket-order.mapper.ts`
- Create: `src/modules/ticket/domain/repositories/ticket-order.repository.interface.ts`
- Create: `src/modules/ticket/infrastructure/persistence/typeorm/ticket-order.typeorm.repository.ts`
- Test: `src/modules/ticket/infrastructure/persistence/mappers/ticket-order.mapper.spec.ts`

**Interfaces:**
- Consumes: `TicketOrder`/`TicketOrderLine` (Task 3).
- Produces: `ITicketOrderRepository { findById(id): Promise<TicketOrder | null>; findExpiredPending(olderThan: Date): Promise<TicketOrder[]>; save(order): Promise<void>; }`, `TICKET_ORDER_REPOSITORY` symbol — consumed by Tasks 10, 11, 12, 14.

- [ ] **Step 1: Write the failing mapper test**

```typescript
// src/modules/ticket/infrastructure/persistence/mappers/ticket-order.mapper.spec.ts
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrderMapper } from './ticket-order.mapper';

describe('TicketOrderMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu, bao gồm các dòng vé', () => {
    const domain = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.ONLINE,
      buyerId: 'customer-1',
      lines: [
        {
          ticketProductId: 'product-1',
          ticketSessionId: 'session-1',
          zoneId: 'zone-1',
          quantity: 3,
          unitPrice: 50000,
        },
      ],
    });
    domain.attachPaymentOrderCode(domain.id);

    const orm = TicketOrderMapper.toOrm(domain);
    orm.id = '1';
    orm.lines.forEach((l, i) => (l.id = String(i + 1)));

    expect(orm.uuid).toBe(domain.id);
    expect(orm.lines).toHaveLength(1);
    expect(orm.lines[0].quantity).toBe(3);
    expect(orm.paymentOrderCode).toBe(domain.id);

    const roundTripped = TicketOrderMapper.toDomain(orm);
    expect(roundTripped.id).toBe(domain.id);
    expect(roundTripped.getTotalAmount()).toBe(150000);
    expect(roundTripped.getStatus()).toBe(domain.getStatus());
    expect(roundTripped.getPaymentOrderCode()).toBe(domain.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/modules/ticket/infrastructure/persistence/mappers/ticket-order.mapper.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the ORM entities**

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order-line.orm-entity.ts
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { TicketOrderOrmEntity } from './ticket-order.orm-entity';

@Entity({ name: 'ticket_order_lines' })
export class TicketOrderLineOrmEntity extends BaseOrmEntity {
  @Column({ name: 'ticket_order_id', type: 'uuid' })
  ticketOrderId: string;

  @ManyToOne(() => TicketOrderOrmEntity, (o) => o.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_order_id', referencedColumnName: 'uuid' })
  ticketOrder?: TicketOrderOrmEntity;

  @Column({ name: 'ticket_product_id', type: 'uuid' })
  ticketProductId: string;

  @Column({ name: 'ticket_session_id', type: 'uuid' })
  ticketSessionId: string;

  @Column({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    name: 'unit_price',
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  unitPrice: number;
}
```

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order.orm-entity.ts
import { Entity, Column, Index, OneToMany } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';
import { TicketOrderLineOrmEntity } from './ticket-order-line.orm-entity';

@Entity({ name: 'ticket_orders' })
export class TicketOrderOrmEntity extends BaseOrmEntity {
  @Index()
  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId: string;

  @Column({ type: 'varchar', length: 20 })
  channel: string;

  @Column({ name: 'buyer_id', type: 'uuid', nullable: true })
  buyerId: string | null;

  @Index()
  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Index({ unique: true })
  @Column({ name: 'payment_order_code', type: 'varchar', length: 100, nullable: true })
  paymentOrderCode: string | null;

  @OneToMany(() => TicketOrderLineOrmEntity, (l) => l.ticketOrder, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  lines: TicketOrderLineOrmEntity[];
}
```

- [ ] **Step 4: Create the mapper**

```typescript
// src/modules/ticket/infrastructure/persistence/mappers/ticket-order.mapper.ts
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderLine } from '@/modules/ticket/domain/models/ticket-order-line.entity';
import {
  TicketOrderChannelEnum,
  TicketOrderStatusEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrderOrmEntity } from '../typeorm/entities/ticket-order.orm-entity';
import { TicketOrderLineOrmEntity } from '../typeorm/entities/ticket-order-line.orm-entity';

export class TicketOrderMapper {
  static toDomain(orm: TicketOrderOrmEntity): TicketOrder {
    return new TicketOrder(
      orm.uuid,
      orm.merchantId,
      orm.channel as TicketOrderChannelEnum,
      orm.buyerId ?? undefined,
      (orm.lines ?? []).map(
        (l) =>
          new TicketOrderLine({
            id: l.uuid,
            ticketProductId: l.ticketProductId,
            ticketSessionId: l.ticketSessionId,
            zoneId: l.zoneId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          }),
      ),
      orm.status as TicketOrderStatusEnum,
      orm.paymentOrderCode ?? undefined,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: TicketOrder): TicketOrderOrmEntity {
    const orm = new TicketOrderOrmEntity();
    orm.uuid = domain.id;
    orm.merchantId = domain.getMerchantId();
    orm.channel = domain.getChannel();
    orm.buyerId = domain.getBuyerId() ?? null;
    orm.status = domain.getStatus();
    orm.paymentOrderCode = domain.getPaymentOrderCode() ?? null;
    orm.lines = domain.getLines().map((l) => {
      const lineOrm = new TicketOrderLineOrmEntity();
      lineOrm.uuid = l.getId();
      lineOrm.ticketProductId = l.getTicketProductId();
      lineOrm.ticketSessionId = l.getTicketSessionId();
      lineOrm.zoneId = l.getZoneId();
      lineOrm.quantity = l.getQuantity();
      lineOrm.unitPrice = l.getUnitPrice();
      return lineOrm;
    });
    return orm;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/modules/ticket/infrastructure/persistence/mappers/ticket-order.mapper.spec.ts`
Expected: PASS

- [ ] **Step 6: Create the repository interface**

```typescript
// src/modules/ticket/domain/repositories/ticket-order.repository.interface.ts
import type { TicketOrder } from '../models/ticket-order.aggregate';

export interface ITicketOrderRepository {
  findById(id: string): Promise<TicketOrder | null>;
  findExpiredPending(olderThan: Date): Promise<TicketOrder[]>;
  save(order: TicketOrder): Promise<void>;
}

export const TICKET_ORDER_REPOSITORY = Symbol('ITicketOrderRepository');
```

- [ ] **Step 7: Create the TypeORM repository**

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/ticket-order.typeorm.repository.ts
import { Injectable } from '@nestjs/common';
import { LessThan, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { ITicketOrderRepository } from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrderOrmEntity } from './entities/ticket-order.orm-entity';
import { TicketOrderMapper } from '../mappers/ticket-order.mapper';

@Injectable()
export class TicketOrderTypeormRepository implements ITicketOrderRepository {
  constructor(
    @InjectRepository(TicketOrderOrmEntity)
    private readonly repo: Repository<TicketOrderOrmEntity>,
  ) {}

  async findById(id: string): Promise<TicketOrder | null> {
    const orm = await this.repo.findOne({ where: { uuid: id }, relations: ['lines'] });
    return orm ? TicketOrderMapper.toDomain(orm) : null;
  }

  async findExpiredPending(olderThan: Date): Promise<TicketOrder[]> {
    const orms = await this.repo.find({
      where: { status: TicketOrderStatusEnum.PENDING, createdAt: LessThan(olderThan) },
      relations: ['lines'],
    });
    return orms.map((orm) => TicketOrderMapper.toDomain(orm));
  }

  async save(order: TicketOrder): Promise<void> {
    const orm = TicketOrderMapper.toOrm(order);

    const existing = await this.repo.findOne({
      where: { uuid: orm.uuid },
      relations: ['lines'],
    });
    if (existing) {
      orm.id = existing.id;
      for (const lineOrm of orm.lines) {
        const existingLine = existing.lines.find((l) => l.uuid === lineOrm.uuid);
        if (existingLine) {
          lineOrm.id = existingLine.id;
        }
      }
    }

    await this.repo.save(orm);
  }
}
```

- [ ] **Step 8: Verify the project compiles**

Run: `bun run build`
Expected: succeeds

- [ ] **Step 9: Commit**

```bash
git add src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order-line.orm-entity.ts src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order.orm-entity.ts src/modules/ticket/infrastructure/persistence/mappers/ticket-order.mapper.ts src/modules/ticket/infrastructure/persistence/mappers/ticket-order.mapper.spec.ts src/modules/ticket/domain/repositories/ticket-order.repository.interface.ts src/modules/ticket/infrastructure/persistence/typeorm/ticket-order.typeorm.repository.ts
git commit -m "feat(ticket): add TicketOrder persistence (orm entities, mapper, repository)"
```

---

### Task 7: Persistence — `Ticket` (ORM entity, mapper, repository)

**Files:**
- Create: `src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket.orm-entity.ts`
- Create: `src/modules/ticket/infrastructure/persistence/mappers/ticket.mapper.ts`
- Create: `src/modules/ticket/domain/repositories/ticket.repository.interface.ts`
- Create: `src/modules/ticket/infrastructure/persistence/typeorm/ticket.typeorm.repository.ts`
- Test: `src/modules/ticket/infrastructure/persistence/mappers/ticket.mapper.spec.ts`

**Interfaces:**
- Consumes: `Ticket` (Task 4).
- Produces: `ITicketRepository { findByOrderId(orderId): Promise<Ticket[]>; saveMany(tickets: Ticket[]): Promise<void>; }`, `TICKET_REPOSITORY` symbol — consumed by Task 11 (confirm handler) and Task 12 (cancel-paid handler).

- [ ] **Step 1: Write the failing mapper test**

```typescript
// src/modules/ticket/infrastructure/persistence/mappers/ticket.mapper.spec.ts
import { Ticket } from '@/modules/ticket/domain/models/ticket.aggregate';
import { TicketStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketMapper } from './ticket.mapper';

describe('TicketMapper', () => {
  it('toOrm() rồi toDomain() giữ nguyên dữ liệu', () => {
    const domain = Ticket.issue({
      ticketOrderId: 'order-1',
      ticketProductId: 'product-1',
      ticketSessionId: 'session-1',
      zoneId: 'zone-1',
      remainingUses: 3,
    });

    const orm = TicketMapper.toOrm(domain);
    orm.id = '1';

    expect(orm.uuid).toBe(domain.id);
    expect(orm.code).toBe(domain.getCode());
    expect(orm.status).toBe(TicketStatusEnum.ISSUED);
    expect(orm.remainingUses).toBe(3);

    const roundTripped = TicketMapper.toDomain(orm);
    expect(roundTripped.id).toBe(domain.id);
    expect(roundTripped.getCode()).toBe(domain.getCode());
    expect(roundTripped.getRemainingUses()).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/modules/ticket/infrastructure/persistence/mappers/ticket.mapper.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the ORM entity**

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket.orm-entity.ts
import { Entity, Column, Index } from 'typeorm';
import { BaseOrmEntity } from '@/shared/infrastructure/persistence/base.orm-entity';

@Entity({ name: 'tickets' })
export class TicketOrmEntity extends BaseOrmEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Index()
  @Column({ name: 'ticket_order_id', type: 'uuid' })
  ticketOrderId: string;

  @Column({ name: 'ticket_product_id', type: 'uuid' })
  ticketProductId: string;

  @Column({ name: 'ticket_session_id', type: 'uuid' })
  ticketSessionId: string;

  @Column({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  @Column({ type: 'varchar', length: 20, default: 'ISSUED' })
  status: string;

  @Column({ name: 'remaining_uses', type: 'int', nullable: true })
  remainingUses: number | null;
}
```

- [ ] **Step 4: Create the mapper**

```typescript
// src/modules/ticket/infrastructure/persistence/mappers/ticket.mapper.ts
import { Ticket } from '@/modules/ticket/domain/models/ticket.aggregate';
import { TicketStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrmEntity } from '../typeorm/entities/ticket.orm-entity';

export class TicketMapper {
  static toDomain(orm: TicketOrmEntity): Ticket {
    return new Ticket(
      orm.uuid,
      orm.code,
      orm.ticketOrderId,
      orm.ticketProductId,
      orm.ticketSessionId,
      orm.zoneId,
      orm.status as TicketStatusEnum,
      orm.remainingUses,
      orm.createdAt,
      orm.updatedAt,
    );
  }

  static toOrm(domain: Ticket): TicketOrmEntity {
    const orm = new TicketOrmEntity();
    orm.uuid = domain.id;
    orm.code = domain.getCode();
    orm.ticketOrderId = domain.getTicketOrderId();
    orm.ticketProductId = domain.getTicketProductId();
    orm.ticketSessionId = domain.getTicketSessionId();
    orm.zoneId = domain.getZoneId();
    orm.status = domain.getStatus();
    orm.remainingUses = domain.getRemainingUses();
    return orm;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/modules/ticket/infrastructure/persistence/mappers/ticket.mapper.spec.ts`
Expected: PASS

- [ ] **Step 6: Create the repository interface and TypeORM repository**

```typescript
// src/modules/ticket/domain/repositories/ticket.repository.interface.ts
import type { Ticket } from '../models/ticket.aggregate';

export interface ITicketRepository {
  findByOrderId(orderId: string): Promise<Ticket[]>;
  saveMany(tickets: Ticket[]): Promise<void>;
}

export const TICKET_REPOSITORY = Symbol('ITicketRepository');
```

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/ticket.typeorm.repository.ts
import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import type { ITicketRepository } from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import { Ticket } from '@/modules/ticket/domain/models/ticket.aggregate';
import { TicketOrmEntity } from './entities/ticket.orm-entity';
import { TicketMapper } from '../mappers/ticket.mapper';

@Injectable()
export class TicketTypeormRepository implements ITicketRepository {
  constructor(
    @InjectRepository(TicketOrmEntity)
    private readonly repo: Repository<TicketOrmEntity>,
  ) {}

  async findByOrderId(orderId: string): Promise<Ticket[]> {
    const orms = await this.repo.find({ where: { ticketOrderId: orderId } });
    return orms.map((orm) => TicketMapper.toDomain(orm));
  }

  async saveMany(tickets: Ticket[]): Promise<void> {
    if (!tickets.length) {
      return;
    }
    await this.repo.save(tickets.map((t) => TicketMapper.toOrm(t)));
  }
}
```

- [ ] **Step 7: Verify the project compiles**

Run: `bun run build`
Expected: succeeds

- [ ] **Step 8: Commit**

```bash
git add src/modules/ticket/infrastructure/persistence/typeorm/entities/ticket.orm-entity.ts src/modules/ticket/infrastructure/persistence/mappers/ticket.mapper.ts src/modules/ticket/infrastructure/persistence/mappers/ticket.mapper.spec.ts src/modules/ticket/domain/repositories/ticket.repository.interface.ts src/modules/ticket/infrastructure/persistence/typeorm/ticket.typeorm.repository.ts
git commit -m "feat(ticket): add Ticket persistence (orm entity, mapper, repository)"
```

---

### Task 8: `TicketAvailabilityService` (Redis soft-hold)

**Files:**
- Create: `src/modules/ticket/infrastructure/redis/ticket-availability.service.ts`
- Test: `src/modules/ticket/infrastructure/redis/ticket-availability.service.spec.ts`

**Interfaces:**
- Consumes: `REDIS_CLIENT` token from `src/infrastructure/redis/redis.module.ts` (global module, always injectable).
- Produces: `TicketAvailabilityService { reserve(sessionId, zoneId, quantity, dbAvailableQuota): Promise<boolean>; release(sessionId, zoneId, quantity): Promise<void>; }` — consumed by Task 10 (create order) and Task 12 (cancel/expire).

**Design note:** the Redis key `ticket:reserve:{sessionId}:{zoneId}` holds a countdown counter seeded from `dbAvailableQuota` the first time it's touched, with a 10-minute TTL. `reserve` atomically checks-and-decrements via a Lua script (so concurrent requests can't both pass the check). When the key expires, the next `reserve` call re-seeds it from the caller-supplied `dbAvailableQuota` — which by then already reflects any quota permanently consumed by confirmed orders — so the counter self-heals every 10 minutes without needing an explicit sync job. `release` is only called on cancel/expire (giving back a hold), never on successful payment (the quota was already permanently consumed in Postgres, so nothing should be added back to the Redis counter).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/modules/ticket/infrastructure/redis/ticket-availability.service.spec.ts
import { TicketAvailabilityService } from './ticket-availability.service';

describe('TicketAvailabilityService', () => {
  const redis = { eval: jest.fn() } as any;
  const service = new TicketAvailabilityService(redis);

  beforeEach(() => jest.clearAllMocks());

  it('reserve() trả về true khi Lua script trả về 1', async () => {
    redis.eval.mockResolvedValueOnce(1);

    const result = await service.reserve('session-1', 'zone-1', 2, 100);

    expect(result).toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'ticket:reserve:session-1:zone-1',
      100,
      2,
    );
  });

  it('reserve() trả về false khi Lua script trả về -1 (không đủ quota)', async () => {
    redis.eval.mockResolvedValueOnce(-1);

    const result = await service.reserve('session-1', 'zone-1', 999, 5);

    expect(result).toBe(false);
  });

  it('release() gọi Lua script INCRBY với đúng key và số lượng', async () => {
    redis.eval.mockResolvedValueOnce(1);

    await service.release('session-1', 'zone-1', 3);

    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      'ticket:reserve:session-1:zone-1',
      3,
    );
  });

  it('reserve() fallback vào so sánh dbAvailableQuota khi Redis lỗi/không phản hồi', async () => {
    redis.eval.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await service.reserve('session-1', 'zone-1', 3, 5);

    expect(result).toBe(true);
  });

  it('reserve() fallback trả về false nếu dbAvailableQuota không đủ khi Redis lỗi', async () => {
    redis.eval.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await service.reserve('session-1', 'zone-1', 999, 5);

    expect(result).toBe(false);
  });

  it('release() nuốt lỗi im lặng khi Redis không phản hồi (không chặn luồng huỷ/expire)', async () => {
    redis.eval.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(service.release('session-1', 'zone-1', 3)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/modules/ticket/infrastructure/redis/ticket-availability.service.spec.ts`
Expected: FAIL — module not found (6 tests once implemented)

- [ ] **Step 3: Implement the service**

```typescript
// src/modules/ticket/infrastructure/redis/ticket-availability.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '@/infrastructure/redis/redis.module';

const RESERVE_TTL_SECONDS = 600;

// Nếu key chưa tồn tại (lần đầu hoặc đã hết TTL), khởi tạo lại từ dbAvailableQuota
// (nguồn chân lý) rồi mới kiểm tra/trừ — nhờ vậy counter tự "hồi phục" đúng mỗi 10 phút
// mà không cần job đồng bộ riêng. Trả về 1 = giữ chỗ thành công, -1 = không đủ quota.
const RESERVE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  redis.call('SET', KEYS[1], ARGV[1], 'EX', ${RESERVE_TTL_SECONDS})
end
local current = tonumber(redis.call('GET', KEYS[1]))
local qty = tonumber(ARGV[2])
if current < qty then
  return -1
end
redis.call('DECRBY', KEYS[1], qty)
return 1
`;

// Chỉ cộng lại nếu key còn tồn tại — nếu đã hết TTL thì lần reserve() kế tiếp sẽ tự
// khởi tạo lại từ dbAvailableQuota nên không cần thao tác gì thêm.
const RELEASE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  redis.call('INCRBY', KEYS[1], ARGV[1])
end
return 1
`;

@Injectable()
export class TicketAvailabilityService {
  private readonly logger = new Logger(TicketAvailabilityService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(sessionId: string, zoneId: string): string {
    return `ticket:reserve:${sessionId}:${zoneId}`;
  }

  async reserve(
    sessionId: string,
    zoneId: string,
    quantity: number,
    dbAvailableQuota: number,
  ): Promise<boolean> {
    try {
      const result = await this.redis.eval(
        RESERVE_SCRIPT,
        1,
        this.key(sessionId, zoneId),
        dbAvailableQuota,
        quantity,
      );
      return result === 1;
    } catch (err) {
      // Redis không khả dụng: fallback so sánh trực tiếp với quota thật (không giữ
      // chỗ mềm được, chấp nhận rủi ro race nhỏ trong lúc Redis gián đoạn — bước
      // trừ quota thật atomic ở ConfirmTicketOrderPaymentHandler vẫn là chốt chặn
      // cuối cùng chống oversell, xem spec §3.4/§4).
      this.logger.warn(`Redis reserve() lỗi, fallback sang so sánh dbAvailableQuota: ${(err as Error).message}`);
      return dbAvailableQuota >= quantity;
    }
  }

  async release(sessionId: string, zoneId: string, quantity: number): Promise<void> {
    try {
      await this.redis.eval(RELEASE_SCRIPT, 1, this.key(sessionId, zoneId), quantity);
    } catch (err) {
      // Nuốt lỗi: nếu key không tự cộng lại được, nó sẽ tự khởi tạo lại đúng giá trị
      // từ dbAvailableQuota ở lần reserve() kế tiếp sau khi hết TTL — không chặn luồng
      // huỷ/expire đơn vé chỉ vì Redis đang gián đoạn.
      this.logger.warn(`Redis release() lỗi, bỏ qua (sẽ tự hồi phục sau TTL): ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/modules/ticket/infrastructure/redis/ticket-availability.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/ticket/infrastructure/redis/ticket-availability.service.ts src/modules/ticket/infrastructure/redis/ticket-availability.service.spec.ts
git commit -m "feat(ticket): add Redis-backed TicketAvailabilityService"
```

---

### Task 9: Merchant creates and publishes ticket products

**Files:**
- Modify: `src/modules/payment/payment.module.ts` (export `PaymentGatewayFactory` so `TicketModule` can reuse it in Task 10 — no other change)
- Create: `src/modules/ticket/application/dtos/ticket-usage-rule.dto.ts`
- Create: `src/modules/ticket/application/dtos/ticket-zone.dto.ts`
- Create: `src/modules/ticket/application/dtos/ticket-session.dto.ts`
- Create: `src/modules/ticket/application/dtos/create-ticket-product.dto.ts`
- Create: `src/modules/ticket/application/commands/create-ticket-product/create-ticket-product.command.ts`
- Create: `src/modules/ticket/application/commands/create-ticket-product/create-ticket-product.handler.ts`
- Create: `src/modules/ticket/application/commands/publish-ticket-product/publish-ticket-product.command.ts`
- Create: `src/modules/ticket/application/commands/publish-ticket-product/publish-ticket-product.handler.ts`
- Create: `src/modules/ticket/presentation/controllers/merchant-ticket-product.controller.ts`
- Test: `src/modules/ticket/application/commands/create-ticket-product/create-ticket-product.handler.spec.ts`
- Test: `src/modules/ticket/application/commands/publish-ticket-product/publish-ticket-product.handler.spec.ts`

**Interfaces:**
- Consumes: `TicketProduct` (Task 2), `ITicketProductRepository`/`TICKET_PRODUCT_REPOSITORY` (Task 5).
- Produces: `CreateTicketProductHandler.execute(cmd): Promise<TicketProduct>`, `PublishTicketProductHandler.execute(cmd): Promise<TicketProduct>` — consumed by the controller in this task; not depended on by later tasks.

- [ ] **Step 1: Export `PaymentGatewayFactory` from `PaymentModule`**

Edit `src/modules/payment/payment.module.ts`, change the `exports` array:

```typescript
  exports: [CreateDepositOrderHandler, ProcessPaymentWebhookHandler, PaymentGatewayFactory],
```

- [ ] **Step 2: Write the failing handler tests**

```typescript
// src/modules/ticket/application/commands/create-ticket-product/create-ticket-product.handler.spec.ts
import { CreateTicketProductHandler } from './create-ticket-product.handler';
import { CreateTicketProductCommand } from './create-ticket-product.command';
import {
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

describe('CreateTicketProductHandler', () => {
  const repo = { save: jest.fn() } as any;
  const handler = new CreateTicketProductHandler(repo);

  beforeEach(() => jest.clearAllMocks());

  it('tạo TicketProduct DRAFT và lưu qua repository', async () => {
    const cmd = new CreateTicketProductCommand(
      'merchant-1',
      'Vé khu vui chơi',
      'Mô tả',
      100000,
      'VND',
      TicketValidityTypeEnum.DAY_PASS,
      { type: TicketUsageTypeEnum.UNLIMITED_USE },
      [{ name: 'DEFAULT', quota: 100 }],
      [{ startAt: new Date('2026-09-01T00:00:00Z'), endAt: new Date('2026-09-01T23:59:59Z') }],
    );

    const result = await handler.execute(cmd);

    expect(result.getMerchantId()).toBe('merchant-1');
    expect(result.getName()).toBe('Vé khu vui chơi');
    expect(repo.save).toHaveBeenCalledWith(result);
  });
});
```

```typescript
// src/modules/ticket/application/commands/publish-ticket-product/publish-ticket-product.handler.spec.ts
import { PublishTicketProductHandler } from './publish-ticket-product.handler';
import { PublishTicketProductCommand } from './publish-ticket-product.command';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import {
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

describe('PublishTicketProductHandler', () => {
  const repo = { findById: jest.fn(), save: jest.fn() } as any;
  const handler = new PublishTicketProductHandler(repo);

  beforeEach(() => jest.clearAllMocks());

  function buildDraft() {
    return TicketProduct.create({
      merchantId: 'merchant-1',
      name: 'Vé zone concert',
      priceAmount: 500000,
      priceCurrency: 'VND',
      validityType: TicketValidityTypeEnum.SESSION,
      usageRule: { type: TicketUsageTypeEnum.UNLIMITED_USE },
      zones: [{ name: 'VIP', quota: 200 }],
      sessions: [{ startAt: new Date('2026-09-01T14:00:00Z'), endAt: new Date('2026-09-01T16:00:00Z') }],
    });
  }

  it('publish loại vé DRAFT thuộc đúng merchant', async () => {
    const draft = buildDraft();
    repo.findById.mockResolvedValueOnce(draft);

    const result = await handler.execute(new PublishTicketProductCommand('merchant-1', draft.id));

    expect(result.isPublished()).toBe(true);
    expect(repo.save).toHaveBeenCalledWith(draft);
  });

  it('ném lỗi 404 khi không tìm thấy loại vé', async () => {
    repo.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new PublishTicketProductCommand('merchant-1', 'khong-ton-tai')),
    ).rejects.toThrow('Không tìm thấy loại vé');
  });

  it('ném lỗi khi loại vé không thuộc merchant gọi lệnh', async () => {
    const draft = buildDraft();
    repo.findById.mockResolvedValueOnce(draft);

    await expect(
      handler.execute(new PublishTicketProductCommand('merchant-khac', draft.id)),
    ).rejects.toThrow('Không tìm thấy loại vé');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test src/modules/ticket/application/commands/create-ticket-product src/modules/ticket/application/commands/publish-ticket-product`
Expected: FAIL — modules not found

- [ ] **Step 4: Create the commands**

```typescript
// src/modules/ticket/application/commands/create-ticket-product/create-ticket-product.command.ts
import { TicketUsageRule, TicketValidityTypeEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

export class CreateTicketProductCommand {
  constructor(
    public readonly merchantId: string,
    public readonly name: string,
    public readonly description: string | undefined,
    public readonly priceAmount: number,
    public readonly priceCurrency: string,
    public readonly validityType: TicketValidityTypeEnum,
    public readonly usageRule: TicketUsageRule,
    public readonly zones: Array<{ name: string; quota: number }>,
    public readonly sessions: Array<{ startAt: Date; endAt: Date }>,
  ) {}
}
```

```typescript
// src/modules/ticket/application/commands/publish-ticket-product/publish-ticket-product.command.ts
export class PublishTicketProductCommand {
  constructor(
    public readonly merchantId: string,
    public readonly ticketProductId: string,
  ) {}
}
```

- [ ] **Step 5: Create the handlers**

```typescript
// src/modules/ticket/application/commands/create-ticket-product/create-ticket-product.handler.ts
import { Inject, Injectable } from '@nestjs/common';
import {
  ITicketProductRepository,
  TICKET_PRODUCT_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import { CreateTicketProductCommand } from './create-ticket-product.command';

@Injectable()
export class CreateTicketProductHandler {
  constructor(
    @Inject(TICKET_PRODUCT_REPOSITORY)
    private readonly productRepo: ITicketProductRepository,
  ) {}

  async execute(cmd: CreateTicketProductCommand): Promise<TicketProduct> {
    const product = TicketProduct.create({
      merchantId: cmd.merchantId,
      name: cmd.name,
      description: cmd.description,
      priceAmount: cmd.priceAmount,
      priceCurrency: cmd.priceCurrency,
      validityType: cmd.validityType,
      usageRule: cmd.usageRule,
      zones: cmd.zones,
      sessions: cmd.sessions,
    });

    await this.productRepo.save(product);
    return product;
  }
}
```

```typescript
// src/modules/ticket/application/commands/publish-ticket-product/publish-ticket-product.handler.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITicketProductRepository,
  TICKET_PRODUCT_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import { PublishTicketProductCommand } from './publish-ticket-product.command';

@Injectable()
export class PublishTicketProductHandler {
  constructor(
    @Inject(TICKET_PRODUCT_REPOSITORY)
    private readonly productRepo: ITicketProductRepository,
  ) {}

  async execute(cmd: PublishTicketProductCommand): Promise<TicketProduct> {
    const product = await this.productRepo.findById(cmd.ticketProductId);
    if (!product || product.getMerchantId() !== cmd.merchantId) {
      throw new NotFoundException('Không tìm thấy loại vé');
    }

    product.publish();
    await this.productRepo.save(product);
    return product;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test src/modules/ticket/application/commands/create-ticket-product src/modules/ticket/application/commands/publish-ticket-product`
Expected: PASS (4 tests)

- [ ] **Step 7: Create the DTOs**

```typescript
// src/modules/ticket/application/dtos/ticket-usage-rule.dto.ts
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TicketUsageTypeEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

export class TicketUsageRuleDto {
  @IsEnum(TicketUsageTypeEnum, { message: 'usageRule.type không hợp lệ' })
  type: TicketUsageTypeEnum;

  @IsOptional()
  @IsInt({ message: 'maxUses phải là số nguyên' })
  @Min(1, { message: 'maxUses phải lớn hơn 0' })
  maxUses?: number;
}
```

```typescript
// src/modules/ticket/application/dtos/ticket-zone.dto.ts
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class TicketZoneDto {
  @IsString({ message: 'name phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'name không được để trống' })
  name: string;

  @IsInt({ message: 'quota phải là số nguyên' })
  @Min(1, { message: 'quota phải lớn hơn 0' })
  quota: number;
}
```

```typescript
// src/modules/ticket/application/dtos/ticket-session.dto.ts
import { IsDateString } from 'class-validator';

export class TicketSessionDto {
  @IsDateString({}, { message: 'startAt phải là chuỗi ISO date hợp lệ' })
  startAt: string;

  @IsDateString({}, { message: 'endAt phải là chuỗi ISO date hợp lệ' })
  endAt: string;
}
```

```typescript
// src/modules/ticket/application/dtos/create-ticket-product.dto.ts
import { ArrayMinSize, IsArray, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TicketValidityTypeEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketUsageRuleDto } from './ticket-usage-rule.dto';
import { TicketZoneDto } from './ticket-zone.dto';
import { TicketSessionDto } from './ticket-session.dto';

export class CreateTicketProductDto {
  @IsString({ message: 'name phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'name không được để trống' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt({ message: 'priceAmount phải là số nguyên' })
  @Min(0, { message: 'priceAmount không được âm' })
  priceAmount: number;

  @IsOptional()
  @IsString()
  priceCurrency?: string;

  @IsString({ message: 'validityType không hợp lệ' })
  validityType: TicketValidityTypeEnum;

  @ValidateNested()
  @Type(() => TicketUsageRuleDto)
  usageRule: TicketUsageRuleDto;

  @IsArray({ message: 'zones phải là mảng' })
  @ArrayMinSize(1, { message: 'zones phải có ít nhất 1 phần tử' })
  @ValidateNested({ each: true })
  @Type(() => TicketZoneDto)
  zones: TicketZoneDto[];

  @IsArray({ message: 'sessions phải là mảng' })
  @ArrayMinSize(1, { message: 'sessions phải có ít nhất 1 phần tử' })
  @ValidateNested({ each: true })
  @Type(() => TicketSessionDto)
  sessions: TicketSessionDto[];
}
```

- [ ] **Step 8: Create the merchant controller**

```typescript
// src/modules/ticket/presentation/controllers/merchant-ticket-product.controller.ts
import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MerchantAuthGuard } from '@/shared/infrastructure/auth/guards/auth-guards.guards';
import { CreateTicketProductHandler } from '../../application/commands/create-ticket-product/create-ticket-product.handler';
import { CreateTicketProductCommand } from '../../application/commands/create-ticket-product/create-ticket-product.command';
import { PublishTicketProductHandler } from '../../application/commands/publish-ticket-product/publish-ticket-product.handler';
import { PublishTicketProductCommand } from '../../application/commands/publish-ticket-product/publish-ticket-product.command';
import { CreateTicketProductDto } from '../../application/dtos/create-ticket-product.dto';

interface AuthenticatedRequest extends Request {
  user: { merchantId: string };
}

@Controller({ path: 'merchant/tickets/products', version: '1' })
@UseGuards(MerchantAuthGuard)
export class MerchantTicketProductController {
  constructor(
    private readonly createHandler: CreateTicketProductHandler,
    private readonly publishHandler: PublishTicketProductHandler,
  ) {}

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTicketProductDto) {
    const product = await this.createHandler.execute(
      new CreateTicketProductCommand(
        req.user.merchantId,
        dto.name,
        dto.description,
        dto.priceAmount,
        dto.priceCurrency ?? 'VND',
        dto.validityType,
        dto.usageRule,
        dto.zones,
        dto.sessions.map((s) => ({ startAt: new Date(s.startAt), endAt: new Date(s.endAt) })),
      ),
    );

    return {
      id: product.id,
      name: product.getName(),
      status: product.getStatus(),
      zones: product.getZones().map((z) => ({ id: z.getId(), name: z.getName(), quota: z.getQuota() })),
      sessions: product
        .getSessions()
        .map((s) => ({ id: s.getId(), startAt: s.getStartAt(), endAt: s.getEndAt() })),
    };
  }

  @Post(':id/publish')
  async publish(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const product = await this.publishHandler.execute(
      new PublishTicketProductCommand(req.user.merchantId, id),
    );
    return { id: product.id, status: product.getStatus() };
  }
}
```

- [ ] **Step 9: Verify the project compiles**

Run: `bun run build`
Expected: succeeds

- [ ] **Step 10: Commit**

```bash
git add src/modules/payment/payment.module.ts src/modules/ticket/application/dtos src/modules/ticket/application/commands/create-ticket-product src/modules/ticket/application/commands/publish-ticket-product src/modules/ticket/presentation/controllers/merchant-ticket-product.controller.ts
git commit -m "feat(ticket): merchant create/publish ticket product endpoints"
```

---

### Task 10: Create ticket order (online + counter)

**Files:**
- Create: `src/modules/ticket/application/commands/create-ticket-order/create-ticket-order.command.ts`
- Create: `src/modules/ticket/application/commands/create-ticket-order/create-ticket-order.handler.ts`
- Test: `src/modules/ticket/application/commands/create-ticket-order/create-ticket-order.handler.spec.ts`

**Interfaces:**
- Consumes: `ITicketProductRepository`/`TICKET_PRODUCT_REPOSITORY` (Task 5), `ITicketOrderRepository`/`TICKET_ORDER_REPOSITORY` (Task 6), `TicketAvailabilityService` (Task 8), `PaymentGatewayFactory`/`IPaymentGateway` (existing `payment` module, exported in Task 9), `TicketOrder` (Task 3).
- Produces: `CreateTicketOrderHandler.execute(cmd): Promise<{ orderId: string; status: string; totalAmount: number; paymentUrl?: string }>` — consumed by the controller in Task 13.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/modules/ticket/application/commands/create-ticket-order/create-ticket-order.handler.spec.ts
import { CreateTicketOrderHandler } from './create-ticket-order.handler';
import { CreateTicketOrderCommand } from './create-ticket-order.command';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import {
  TicketOrderChannelEnum,
  TicketUsageTypeEnum,
  TicketValidityTypeEnum,
} from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { PaymentGatewayEnum } from '@/modules/payment/domain/value-objects/payment-status.vo';

describe('CreateTicketOrderHandler', () => {
  const productRepo = { findPublishedById: jest.fn() } as any;
  const orderRepo = { save: jest.fn() } as any;
  const availabilityService = { reserve: jest.fn(), release: jest.fn() } as any;
  const gateway = { createPaymentUrl: jest.fn() };
  const gatewayFactory = { get: jest.fn().mockReturnValue(gateway) } as any;
  const handler = new CreateTicketOrderHandler(
    productRepo,
    orderRepo,
    availabilityService,
    gatewayFactory,
  );

  function buildProduct() {
    return TicketProduct.create({
      merchantId: 'merchant-1',
      name: 'Vé khu vui chơi',
      priceAmount: 100000,
      priceCurrency: 'VND',
      validityType: TicketValidityTypeEnum.DAY_PASS,
      usageRule: { type: TicketUsageTypeEnum.UNLIMITED_USE },
      zones: [{ name: 'DEFAULT', quota: 100 }],
      sessions: [{ startAt: new Date('2026-01-01T00:00:00Z'), endAt: new Date('2099-01-01T23:59:59Z') }],
    });
  }

  beforeEach(() => jest.clearAllMocks());

  it('kênh ONLINE: giữ chỗ thành công -> tạo order PENDING + trả về paymentUrl', async () => {
    const product = buildProduct();
    productRepo.findPublishedById.mockResolvedValueOnce(product);
    availabilityService.reserve.mockResolvedValueOnce(true);
    gateway.createPaymentUrl.mockResolvedValueOnce({ paymentUrl: 'https://pay.example/abc' });

    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    const result = await handler.execute(
      new CreateTicketOrderCommand(
        'merchant-1',
        TicketOrderChannelEnum.ONLINE,
        'customer-1',
        [{ ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 2 }],
        PaymentGatewayEnum.PAYOS,
        'https://frontend.example/return',
      ),
    );

    expect(result.status).toBe('PENDING');
    expect(result.totalAmount).toBe(200000);
    expect(result.paymentUrl).toBe('https://pay.example/abc');
    expect(availabilityService.reserve).toHaveBeenCalledWith(sessionId, zoneId, 2, 100);
    expect(orderRepo.save).toHaveBeenCalled();
  });

  it('kênh COUNTER: không tạo payment link, order vẫn PENDING chờ merchant xác nhận thu tiền', async () => {
    const product = buildProduct();
    productRepo.findPublishedById.mockResolvedValueOnce(product);
    availabilityService.reserve.mockResolvedValueOnce(true);

    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    const result = await handler.execute(
      new CreateTicketOrderCommand(
        'merchant-1',
        TicketOrderChannelEnum.COUNTER,
        undefined,
        [{ ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 1 }],
      ),
    );

    expect(result.status).toBe('PENDING');
    expect(result.paymentUrl).toBeUndefined();
    expect(gatewayFactory.get).not.toHaveBeenCalled();
  });

  it('ném lỗi 409 khi hết quota (reserve trả về false)', async () => {
    const product = buildProduct();
    productRepo.findPublishedById.mockResolvedValueOnce(product);
    availabilityService.reserve.mockResolvedValueOnce(false);

    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    await expect(
      handler.execute(
        new CreateTicketOrderCommand(
          'merchant-1',
          TicketOrderChannelEnum.COUNTER,
          undefined,
          [{ ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 999 }],
        ),
      ),
    ).rejects.toThrow('Không đủ vé còn lại');

    expect(orderRepo.save).not.toHaveBeenCalled();
  });

  it('ném lỗi 404 khi loại vé chưa publish hoặc không tồn tại', async () => {
    productRepo.findPublishedById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(
        new CreateTicketOrderCommand('merchant-1', TicketOrderChannelEnum.COUNTER, undefined, [
          { ticketProductId: 'khong-ton-tai', ticketSessionId: 's', zoneId: 'z', quantity: 1 },
        ]),
      ),
    ).rejects.toThrow('Loại vé không khả dụng để bán');
  });

  it('giữ chỗ thành công 1 dòng nhưng dòng thứ 2 hết quota -> nhả lại dòng đã giữ và ném lỗi', async () => {
    const product = buildProduct();
    productRepo.findPublishedById.mockResolvedValue(product);
    availabilityService.reserve.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const zoneId = product.getZones()[0].getId();
    const sessionId = product.getSessions()[0].getId();

    await expect(
      handler.execute(
        new CreateTicketOrderCommand('merchant-1', TicketOrderChannelEnum.COUNTER, undefined, [
          { ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 1 },
          { ticketProductId: product.id, ticketSessionId: sessionId, zoneId, quantity: 1 },
        ]),
      ),
    ).rejects.toThrow('Không đủ vé còn lại');

    expect(availabilityService.release).toHaveBeenCalledWith(sessionId, zoneId, 1);
    expect(orderRepo.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/modules/ticket/application/commands/create-ticket-order`
Expected: FAIL — module not found

- [ ] **Step 3: Create the command**

```typescript
// src/modules/ticket/application/commands/create-ticket-order/create-ticket-order.command.ts
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { PaymentGatewayEnum } from '@/modules/payment/domain/value-objects/payment-status.vo';

export interface CreateTicketOrderLineInput {
  ticketProductId: string;
  ticketSessionId: string;
  zoneId: string;
  quantity: number;
}

export class CreateTicketOrderCommand {
  constructor(
    public readonly merchantId: string,
    public readonly channel: TicketOrderChannelEnum,
    public readonly buyerId: string | undefined,
    public readonly lines: CreateTicketOrderLineInput[],
    public readonly gateway?: PaymentGatewayEnum,
    public readonly returnUrl?: string,
  ) {}
}
```

- [ ] **Step 4: Implement the handler**

```typescript
// src/modules/ticket/application/commands/create-ticket-order/create-ticket-order.handler.ts
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITicketProductRepository,
  TICKET_PRODUCT_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import {
  ITicketOrderRepository,
  TICKET_ORDER_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TicketAvailabilityService } from '@/modules/ticket/infrastructure/redis/ticket-availability.service';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { PaymentGatewayFactory } from '@/modules/payment/infrastructure/gateways/payment-gateway.factory';
import { CreateTicketOrderCommand } from './create-ticket-order.command';

export interface CreateTicketOrderResult {
  orderId: string;
  status: string;
  totalAmount: number;
  paymentUrl?: string;
}

@Injectable()
export class CreateTicketOrderHandler {
  constructor(
    @Inject(TICKET_PRODUCT_REPOSITORY)
    private readonly productRepo: ITicketProductRepository,
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    private readonly availabilityService: TicketAvailabilityService,
    private readonly gatewayFactory: PaymentGatewayFactory,
  ) {}

  async execute(cmd: CreateTicketOrderCommand): Promise<CreateTicketOrderResult> {
    if (!cmd.lines.length) {
      throw new BadRequestException('Đơn vé phải có ít nhất 1 dòng vé');
    }

    const now = new Date();
    const orderLines: { ticketProductId: string; ticketSessionId: string; zoneId: string; quantity: number; unitPrice: number }[] = [];
    const reservedForCompensation: { sessionId: string; zoneId: string; quantity: number }[] = [];

    try {
      for (const line of cmd.lines) {
        const product = await this.productRepo.findPublishedById(line.ticketProductId);
        if (!product) {
          throw new NotFoundException('Loại vé không khả dụng để bán');
        }

        const session = product.findSession(line.ticketSessionId);
        if (!session || !session.isActiveAt(now)) {
          throw new NotFoundException('Suất vé không còn hiệu lực');
        }

        const zone = product.findZone(line.zoneId);
        if (!zone) {
          throw new NotFoundException('Khu vực vé không tồn tại');
        }

        const reserved = await this.availabilityService.reserve(
          line.ticketSessionId,
          line.zoneId,
          line.quantity,
          zone.getQuota(),
        );
        if (!reserved) {
          throw new ConflictException('Không đủ vé còn lại');
        }
        reservedForCompensation.push({
          sessionId: line.ticketSessionId,
          zoneId: line.zoneId,
          quantity: line.quantity,
        });

        orderLines.push({
          ticketProductId: line.ticketProductId,
          ticketSessionId: line.ticketSessionId,
          zoneId: line.zoneId,
          quantity: line.quantity,
          unitPrice: product.getPriceAmount(),
        });
      }
    } catch (err) {
      for (const hold of reservedForCompensation) {
        await this.availabilityService.release(hold.sessionId, hold.zoneId, hold.quantity);
      }
      throw err;
    }

    const order = TicketOrder.create({
      merchantId: cmd.merchantId,
      channel: cmd.channel,
      buyerId: cmd.buyerId,
      lines: orderLines,
    });

    let paymentUrl: string | undefined;
    if (cmd.channel === TicketOrderChannelEnum.ONLINE) {
      if (!cmd.gateway || !cmd.returnUrl) {
        throw new BadRequestException('Đơn vé online phải chỉ định gateway và returnUrl');
      }
      const gatewayService = this.gatewayFactory.get(cmd.gateway);
      const result = await gatewayService.createPaymentUrl({
        orderCode: order.id,
        amount: order.getTotalAmount(),
        description: `Thanh toan don ve ${order.id}`,
        returnUrl: cmd.returnUrl,
      });
      paymentUrl = result.paymentUrl;
      order.attachPaymentOrderCode(order.id);
    }

    await this.orderRepo.save(order);

    return {
      orderId: order.id,
      status: order.getStatus(),
      totalAmount: order.getTotalAmount(),
      paymentUrl,
    };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/modules/ticket/application/commands/create-ticket-order`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/ticket/application/commands/create-ticket-order
git commit -m "feat(ticket): create ticket order (online + counter) with Redis-backed oversell guard"
```

---

### Task 11: Confirm ticket order payment (issue tickets, deduct real quota)

**Files:**
- Create: `src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.command.ts`
- Create: `src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler.ts`
- Test: `src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler.spec.ts`

**Interfaces:**
- Consumes: `ITicketOrderRepository`/`TICKET_ORDER_REPOSITORY` (Task 6), `Ticket` (Task 4), `TicketOrderOrmEntity`/`TicketZoneOrmEntity`/`TicketOrmEntity` (Tasks 5–7), `TypeORM DataSource`.
- Produces: `ConfirmTicketOrderPaymentHandler.execute(cmd): Promise<{ orderId: string; tickets: { code: string }[] }>` — consumed by the webhook controller and the counter-payment-confirm handler in Task 13.

**Design note:** this is the one handler in the module that opens a raw `DataSource.transaction()` because it must atomically (a) conditionally decrement each zone's real quota in Postgres (`UPDATE ... WHERE quota >= :qty`, the actual oversell guard), (b) insert one `Ticket` row per unit purchased, and (c) flip the order to `PAID` — all three commit together or none do. This is idempotent: if the order is already `PAID`, it returns the previously issued tickets without touching quota again (protects against duplicate webhook delivery).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler.spec.ts
import { ConfirmTicketOrderPaymentHandler } from './confirm-ticket-order-payment.handler';
import { ConfirmTicketOrderPaymentCommand } from './confirm-ticket-order-payment.command';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

function buildOrder() {
  return TicketOrder.create({
    merchantId: 'merchant-1',
    channel: TicketOrderChannelEnum.ONLINE,
    buyerId: 'customer-1',
    lines: [
      {
        ticketProductId: 'product-1',
        ticketSessionId: 'session-1',
        zoneId: 'zone-1',
        quantity: 2,
        unitPrice: 100000,
      },
    ],
  });
}

describe('ConfirmTicketOrderPaymentHandler', () => {
  const orderRepo = { findById: jest.fn() } as any;
  const ticketRepo = { findByOrderId: jest.fn() } as any;
  const manager = {
    getRepository: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as any;
  const dataSource = { transaction: jest.fn((cb: any) => cb(manager)) } as any;
  const handler = new ConfirmTicketOrderPaymentHandler(orderRepo, ticketRepo, dataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation((cb: any) => cb(manager));
  });

  it('trả về vé đã có sẵn (idempotent) nếu order đã PAID, không mở transaction quota', async () => {
    const order = buildOrder();
    order.markAsPaid();
    orderRepo.findById.mockResolvedValueOnce(order);
    ticketRepo.findByOrderId.mockResolvedValueOnce([{ getCode: () => 'TKT-ABC' }]);

    const result = await handler.execute(new ConfirmTicketOrderPaymentCommand(order.id));

    expect(result.tickets).toEqual([{ code: 'TKT-ABC' }]);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('ném lỗi 404 khi order không tồn tại', async () => {
    orderRepo.findById.mockResolvedValueOnce(null);

    await expect(
      handler.execute(new ConfirmTicketOrderPaymentCommand('khong-ton-tai')),
    ).rejects.toThrow('Không tìm thấy đơn vé');
  });

  it('ném lỗi 400 khi order không ở trạng thái PENDING (vd đã bị huỷ)', async () => {
    const order = buildOrder();
    order.markAsCancelled();
    orderRepo.findById.mockResolvedValueOnce(order);

    await expect(handler.execute(new ConfirmTicketOrderPaymentCommand(order.id))).rejects.toThrow(
      'Đơn vé không ở trạng thái chờ thanh toán',
    );
  });

  it('order PENDING hợp lệ: trừ quota qua queryBuilder, issue đúng số vé bằng tổng quantity, chuyển order sang PAID', async () => {
    const order = buildOrder(); // 1 dòng, quantity = 2
    orderRepo.findById.mockResolvedValueOnce(order);

    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    manager.createQueryBuilder.mockReturnValue(qb);
    manager.save = jest.fn().mockResolvedValue(undefined);
    manager.update = jest.fn().mockResolvedValue(undefined);

    const result = await handler.execute(new ConfirmTicketOrderPaymentCommand(order.id));

    expect(result.tickets).toHaveLength(2);
    expect(order.getStatus()).toBe('PAID');
    expect(qb.where).toHaveBeenCalledWith('uuid = :zoneId AND quota >= :qty', {
      zoneId: 'zone-1',
      qty: 2,
    });
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { uuid: order.id },
      { status: 'PAID' },
    );
  });

  it('ném ConflictException nếu queryBuilder báo affected=0 (hết quota tại thời điểm xác nhận)', async () => {
    const order = buildOrder();
    orderRepo.findById.mockResolvedValueOnce(order);

    const qb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    manager.createQueryBuilder.mockReturnValue(qb);

    await expect(handler.execute(new ConfirmTicketOrderPaymentCommand(order.id))).rejects.toThrow(
      'Không đủ vé còn lại',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/modules/ticket/application/commands/confirm-ticket-order-payment`
Expected: FAIL — module not found

- [ ] **Step 3: Create the command**

```typescript
// src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.command.ts
export class ConfirmTicketOrderPaymentCommand {
  constructor(public readonly ticketOrderId: string) {}
}
```

- [ ] **Step 4: Implement the handler**

```typescript
// src/modules/ticket/application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler.ts
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ITicketOrderRepository,
  TICKET_ORDER_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import {
  ITicketRepository,
  TICKET_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import { Ticket } from '@/modules/ticket/domain/models/ticket.aggregate';
import { TicketOrderStatusEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';
import { TicketOrderOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order.orm-entity';
import { TicketZoneOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-zone.orm-entity';
import { TicketOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket.orm-entity';
import { TicketMapper } from '@/modules/ticket/infrastructure/persistence/mappers/ticket.mapper';
import { ConfirmTicketOrderPaymentCommand } from './confirm-ticket-order-payment.command';

export interface ConfirmTicketOrderPaymentResult {
  orderId: string;
  tickets: { code: string }[];
}

@Injectable()
export class ConfirmTicketOrderPaymentHandler {
  constructor(
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(cmd: ConfirmTicketOrderPaymentCommand): Promise<ConfirmTicketOrderPaymentResult> {
    const order = await this.orderRepo.findById(cmd.ticketOrderId);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn vé');
    }

    if (order.getStatus() === TicketOrderStatusEnum.PAID) {
      const tickets = await this.ticketRepo.findByOrderId(order.id);
      return { orderId: order.id, tickets: tickets.map((t) => ({ code: t.getCode() })) };
    }

    if (order.getStatus() !== TicketOrderStatusEnum.PENDING) {
      throw new BadRequestException('Đơn vé không ở trạng thái chờ thanh toán');
    }

    const issuedTickets: Ticket[] = [];

    await this.dataSource.transaction(async (manager) => {
      for (const line of order.getLines()) {
        const updateResult = await manager
          .createQueryBuilder()
          .update(TicketZoneOrmEntity)
          .set({ quota: () => `quota - ${line.getQuantity()}` })
          .where('uuid = :zoneId AND quota >= :qty', {
            zoneId: line.getZoneId(),
            qty: line.getQuantity(),
          })
          .execute();

        if (updateResult.affected === 0) {
          throw new ConflictException(
            `Không đủ vé còn lại cho zone ${line.getZoneId()} tại thời điểm xác nhận thanh toán`,
          );
        }

        for (let i = 0; i < line.getQuantity(); i += 1) {
          issuedTickets.push(
            Ticket.issue({
              ticketOrderId: order.id,
              ticketProductId: line.getTicketProductId(),
              ticketSessionId: line.getTicketSessionId(),
              zoneId: line.getZoneId(),
              remainingUses: null,
            }),
          );
        }
      }

      await manager.save(TicketOrmEntity, issuedTickets.map((t) => TicketMapper.toOrm(t)));

      order.markAsPaid();
      await manager.update(
        TicketOrderOrmEntity,
        { uuid: order.id },
        { status: order.getStatus() },
      );
    });

    return { orderId: order.id, tickets: issuedTickets.map((t) => ({ code: t.getCode() })) };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test src/modules/ticket/application/commands/confirm-ticket-order-payment`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/modules/ticket/application/commands/confirm-ticket-order-payment
git commit -m "feat(ticket): confirm ticket order payment — atomic quota deduction and ticket issuance"
```

---

### Task 12: Cancel pending/failed orders and refund a paid order

**Files:**
- Create: `src/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.command.ts`
- Create: `src/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.handler.ts`
- Create: `src/modules/ticket/application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.command.ts`
- Create: `src/modules/ticket/application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.handler.ts`
- Test: `src/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.handler.spec.ts`
- Test: `src/modules/ticket/application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.handler.spec.ts`

**Interfaces:**
- Consumes: `ITicketOrderRepository` (Task 6), `ITicketRepository` (Task 7), `TicketAvailabilityService` (Task 8), `TicketZoneOrmEntity` (Task 5), `DataSource`.
- Produces: `CancelTicketOrderHandler.execute(cmd): Promise<void>` (used by the payment-failure path and by Task 14's expiry job), `CancelPaidTicketOrderHandler.execute(cmd): Promise<void>` (used by the merchant-refund endpoint in Task 13).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.handler.spec.ts
import { CancelTicketOrderHandler } from './cancel-ticket-order.handler';
import { CancelTicketOrderCommand } from './cancel-ticket-order.command';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

function buildOrder() {
  return TicketOrder.create({
    merchantId: 'merchant-1',
    channel: TicketOrderChannelEnum.COUNTER,
    lines: [
      {
        ticketProductId: 'product-1',
        ticketSessionId: 'session-1',
        zoneId: 'zone-1',
        quantity: 2,
        unitPrice: 100000,
      },
    ],
  });
}

describe('CancelTicketOrderHandler', () => {
  const orderRepo = { findById: jest.fn(), save: jest.fn() } as any;
  const availabilityService = { release: jest.fn() } as any;
  const handler = new CancelTicketOrderHandler(orderRepo, availabilityService);

  beforeEach(() => jest.clearAllMocks());

  it('huỷ đơn PENDING, nhả lại quota Redis cho từng dòng', async () => {
    const order = buildOrder();
    orderRepo.findById.mockResolvedValueOnce(order);

    await handler.execute(new CancelTicketOrderCommand(order.id, 'CANCELLED'));

    expect(order.getStatus()).toBe('CANCELLED');
    expect(availabilityService.release).toHaveBeenCalledWith('session-1', 'zone-1', 2);
    expect(orderRepo.save).toHaveBeenCalledWith(order);
  });

  it('finalStatus=EXPIRED gọi markAsExpired thay vì markAsCancelled', async () => {
    const order = buildOrder();
    orderRepo.findById.mockResolvedValueOnce(order);

    await handler.execute(new CancelTicketOrderCommand(order.id, 'EXPIRED'));

    expect(order.getStatus()).toBe('EXPIRED');
  });

  it('ném lỗi 404 khi order không tồn tại', async () => {
    orderRepo.findById.mockResolvedValueOnce(null);

    await expect(handler.execute(new CancelTicketOrderCommand('x', 'CANCELLED'))).rejects.toThrow(
      'Không tìm thấy đơn vé',
    );
  });
});
```

```typescript
// src/modules/ticket/application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.handler.spec.ts
import { CancelPaidTicketOrderHandler } from './cancel-paid-ticket-order.handler';
import { CancelPaidTicketOrderCommand } from './cancel-paid-ticket-order.command';
import { TicketOrder } from '@/modules/ticket/domain/models/ticket-order.aggregate';
import { TicketOrderChannelEnum } from '@/modules/ticket/domain/value-objects/ticket-enums.vo';

function buildPaidOrder() {
  const order = TicketOrder.create({
    merchantId: 'merchant-1',
    channel: TicketOrderChannelEnum.COUNTER,
    lines: [
      {
        ticketProductId: 'product-1',
        ticketSessionId: 'session-1',
        zoneId: 'zone-1',
        quantity: 2,
        unitPrice: 100000,
      },
    ],
  });
  order.markAsPaid();
  return order;
}

describe('CancelPaidTicketOrderHandler', () => {
  const orderRepo = { findById: jest.fn(), save: jest.fn() } as any;
  const ticketRepo = { findByOrderId: jest.fn(), saveMany: jest.fn() } as any;
  const manager = { createQueryBuilder: jest.fn(), update: jest.fn() } as any;
  const dataSource = { transaction: jest.fn((cb: any) => cb(manager)) } as any;
  const handler = new CancelPaidTicketOrderHandler(orderRepo, ticketRepo, dataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.transaction.mockImplementation((cb: any) => cb(manager));
    manager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    });
  });

  it('huỷ đơn PAID: huỷ tất cả vé + cộng lại quota thật cho từng zone', async () => {
    const order = buildPaidOrder();
    orderRepo.findById.mockResolvedValueOnce(order);
    ticketRepo.findByOrderId.mockResolvedValueOnce([]);

    await handler.execute(new CancelPaidTicketOrderCommand(order.id));

    expect(order.getStatus()).toBe('CANCELLED');
    expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1);
  });

  it('ném lỗi khi order chưa PAID', async () => {
    const order = TicketOrder.create({
      merchantId: 'merchant-1',
      channel: TicketOrderChannelEnum.COUNTER,
      lines: [
        { ticketProductId: 'p', ticketSessionId: 's', zoneId: 'z', quantity: 1, unitPrice: 1000 },
      ],
    });
    orderRepo.findById.mockResolvedValueOnce(order);

    await expect(handler.execute(new CancelPaidTicketOrderCommand(order.id))).rejects.toThrow(
      'Chỉ có thể huỷ đơn đã PAID bằng phương thức này',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/modules/ticket/application/commands/cancel-ticket-order src/modules/ticket/application/commands/cancel-paid-ticket-order`
Expected: FAIL — modules not found

- [ ] **Step 3: Create commands**

```typescript
// src/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.command.ts
export class CancelTicketOrderCommand {
  constructor(
    public readonly ticketOrderId: string,
    public readonly finalStatus: 'CANCELLED' | 'EXPIRED',
  ) {}
}
```

```typescript
// src/modules/ticket/application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.command.ts
export class CancelPaidTicketOrderCommand {
  constructor(public readonly ticketOrderId: string) {}
}
```

- [ ] **Step 4: Implement `CancelTicketOrderHandler`**

```typescript
// src/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.handler.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ITicketOrderRepository,
  TICKET_ORDER_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { TicketAvailabilityService } from '@/modules/ticket/infrastructure/redis/ticket-availability.service';
import { CancelTicketOrderCommand } from './cancel-ticket-order.command';

@Injectable()
export class CancelTicketOrderHandler {
  constructor(
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    private readonly availabilityService: TicketAvailabilityService,
  ) {}

  async execute(cmd: CancelTicketOrderCommand): Promise<void> {
    const order = await this.orderRepo.findById(cmd.ticketOrderId);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn vé');
    }

    if (cmd.finalStatus === 'EXPIRED') {
      order.markAsExpired();
    } else {
      order.markAsCancelled();
    }

    for (const line of order.getLines()) {
      await this.availabilityService.release(line.getTicketSessionId(), line.getZoneId(), line.getQuantity());
    }

    await this.orderRepo.save(order);
  }
}
```

- [ ] **Step 5: Implement `CancelPaidTicketOrderHandler`**

```typescript
// src/modules/ticket/application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.handler.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ITicketOrderRepository,
  TICKET_ORDER_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import {
  ITicketRepository,
  TICKET_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket.repository.interface';
import { TicketZoneOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-zone.orm-entity';
import { TicketOrderOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket-order.orm-entity';
import { TicketOrmEntity } from '@/modules/ticket/infrastructure/persistence/typeorm/entities/ticket.orm-entity';
import { CancelPaidTicketOrderCommand } from './cancel-paid-ticket-order.command';

@Injectable()
export class CancelPaidTicketOrderHandler {
  constructor(
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    @Inject(TICKET_REPOSITORY)
    private readonly ticketRepo: ITicketRepository,
    private readonly dataSource: DataSource,
  ) {}

  async execute(cmd: CancelPaidTicketOrderCommand): Promise<void> {
    const order = await this.orderRepo.findById(cmd.ticketOrderId);
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn vé');
    }

    // Ném lỗi trước khi mở transaction nếu order chưa PAID (đúng ngữ nghĩa domain).
    order.cancelPaidOrder();

    const tickets = await this.ticketRepo.findByOrderId(order.id);

    await this.dataSource.transaction(async (manager) => {
      for (const line of order.getLines()) {
        await manager
          .createQueryBuilder()
          .update(TicketZoneOrmEntity)
          .set({ quota: () => `quota + ${line.getQuantity()}` })
          .where('uuid = :zoneId', { zoneId: line.getZoneId() })
          .execute();
      }

      if (tickets.length) {
        await manager.update(
          TicketOrmEntity,
          { ticketOrderId: order.id },
          { status: 'CANCELLED' },
        );
      }

      await manager.update(TicketOrderOrmEntity, { uuid: order.id }, { status: order.getStatus() });
    });
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test src/modules/ticket/application/commands/cancel-ticket-order src/modules/ticket/application/commands/cancel-paid-ticket-order`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add src/modules/ticket/application/commands/cancel-ticket-order src/modules/ticket/application/commands/cancel-paid-ticket-order
git commit -m "feat(ticket): cancel pending/failed orders and refund-cancel paid orders"
```

---

### Task 13: Presentation — order controller and payment webhook controller

**Files:**
- Create: `src/modules/ticket/application/dtos/create-ticket-order.dto.ts`
- Create: `src/modules/ticket/presentation/controllers/ticket-order.controller.ts`
- Create: `src/modules/ticket/presentation/controllers/ticket-order-webhook.controller.ts`

**Interfaces:**
- Consumes: `CreateTicketOrderHandler` (Task 10), `ConfirmTicketOrderPaymentHandler` (Task 11), `CancelTicketOrderHandler`/`CancelPaidTicketOrderHandler` (Task 12), `PaymentGatewayFactory` (existing `payment` module), `CustomerAuthGuard`/`MerchantAuthGuard`.
- Produces: HTTP endpoints — no other task depends on these directly.

This task is pure wiring (controllers calling already-tested handlers); it is verified with `bun run build` plus a manual smoke check, not new unit tests.

- [ ] **Step 1: Create the order DTO**

```typescript
// src/modules/ticket/application/dtos/create-ticket-order.dto.ts
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentGatewayEnum } from '@/modules/payment/domain/value-objects/payment-status.vo';

export class TicketOrderLineDto {
  @IsUUID()
  ticketProductId: string;

  @IsUUID()
  ticketSessionId: string;

  @IsUUID()
  zoneId: string;

  @IsInt({ message: 'quantity phải là số nguyên' })
  @Min(1, { message: 'quantity phải lớn hơn 0' })
  quantity: number;
}

export class CreateTicketOrderDto {
  @IsArray({ message: 'lines phải là mảng' })
  @ArrayMinSize(1, { message: 'lines phải có ít nhất 1 phần tử' })
  @ValidateNested({ each: true })
  @Type(() => TicketOrderLineDto)
  lines: TicketOrderLineDto[];

  @IsOptional()
  @IsEnum(PaymentGatewayEnum, { message: 'gateway không hợp lệ' })
  gateway?: PaymentGatewayEnum;

  @IsOptional()
  @IsString()
  returnUrl?: string;
}
```

- [ ] **Step 2: Create the order controller (customer online purchase + merchant counter sale/confirm/cancel)**

```typescript
// src/modules/ticket/presentation/controllers/ticket-order.controller.ts
import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerAuthGuard, MerchantAuthGuard } from '@/shared/infrastructure/auth/guards/auth-guards.guards';
import { CreateTicketOrderHandler } from '../../application/commands/create-ticket-order/create-ticket-order.handler';
import { CreateTicketOrderCommand } from '../../application/commands/create-ticket-order/create-ticket-order.command';
import { ConfirmTicketOrderPaymentHandler } from '../../application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler';
import { ConfirmTicketOrderPaymentCommand } from '../../application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.command';
import { CancelTicketOrderHandler } from '../../application/commands/cancel-ticket-order/cancel-ticket-order.handler';
import { CancelTicketOrderCommand } from '../../application/commands/cancel-ticket-order/cancel-ticket-order.command';
import { CancelPaidTicketOrderHandler } from '../../application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.handler';
import { CancelPaidTicketOrderCommand } from '../../application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.command';
import { CreateTicketOrderDto } from '../../application/dtos/create-ticket-order.dto';
import { TicketOrderChannelEnum } from '../../domain/value-objects/ticket-enums.vo';

interface CustomerRequest extends Request {
  user: { merchantId: string; sub: string };
}

interface MerchantRequest extends Request {
  user: { merchantId: string };
}

@Controller({ path: 'customer/tickets/orders', version: '1' })
@UseGuards(CustomerAuthGuard)
export class CustomerTicketOrderController {
  constructor(private readonly createOrderHandler: CreateTicketOrderHandler) {}

  @Post()
  async create(@Req() req: CustomerRequest, @Body() dto: CreateTicketOrderDto) {
    return this.createOrderHandler.execute(
      new CreateTicketOrderCommand(
        req.user.merchantId,
        TicketOrderChannelEnum.ONLINE,
        req.user.sub,
        dto.lines,
        dto.gateway,
        dto.returnUrl,
      ),
    );
  }
}

@Controller({ path: 'merchant/tickets/orders', version: '1' })
@UseGuards(MerchantAuthGuard)
export class MerchantTicketOrderController {
  constructor(
    private readonly createOrderHandler: CreateTicketOrderHandler,
    private readonly confirmPaymentHandler: ConfirmTicketOrderPaymentHandler,
    private readonly cancelOrderHandler: CancelTicketOrderHandler,
    private readonly cancelPaidOrderHandler: CancelPaidTicketOrderHandler,
  ) {}

  @Post()
  async createCounterOrder(@Req() req: MerchantRequest, @Body() dto: CreateTicketOrderDto) {
    return this.createOrderHandler.execute(
      new CreateTicketOrderCommand(
        req.user.merchantId,
        TicketOrderChannelEnum.COUNTER,
        undefined,
        dto.lines,
      ),
    );
  }

  @Post(':id/confirm-payment')
  async confirmCounterPayment(@Param('id') id: string) {
    return this.confirmPaymentHandler.execute(new ConfirmTicketOrderPaymentCommand(id));
  }

  @Post(':id/cancel')
  async cancelPendingOrder(@Param('id') id: string) {
    await this.cancelOrderHandler.execute(new CancelTicketOrderCommand(id, 'CANCELLED'));
    return { id, status: 'CANCELLED' };
  }

  @Post(':id/refund')
  async cancelPaidOrder(@Param('id') id: string) {
    await this.cancelPaidOrderHandler.execute(new CancelPaidTicketOrderCommand(id));
    return { id, status: 'CANCELLED' };
  }
}
```

- [ ] **Step 3: Create the payment webhook controller**

Mirrors `src/modules/payment/presentation/controllers/payment-webhook.controller.ts`'s VNPay IPN handling, but calls `ConfirmTicketOrderPaymentHandler`/`CancelTicketOrderHandler` instead of the wallet-deposit webhook handler. `order.id` was used as `orderCode` when the payment link was created in Task 10, so it round-trips directly as `vnp_TxnRef`.

```typescript
// src/modules/ticket/presentation/controllers/ticket-order-webhook.controller.ts
import { Controller, Get, Query, Res, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { PaymentGatewayFactory } from '@/modules/payment/infrastructure/gateways/payment-gateway.factory';
import { PaymentGatewayEnum } from '@/modules/payment/domain/value-objects/payment-status.vo';
import { ConfirmTicketOrderPaymentHandler } from '../../application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler';
import { ConfirmTicketOrderPaymentCommand } from '../../application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.command';
import { CancelTicketOrderHandler } from '../../application/commands/cancel-ticket-order/cancel-ticket-order.handler';
import { CancelTicketOrderCommand } from '../../application/commands/cancel-ticket-order/cancel-ticket-order.command';

@Controller('public/webhooks/ticket-payment')
export class TicketOrderWebhookController {
  private readonly logger = new Logger(TicketOrderWebhookController.name);

  constructor(
    private readonly gatewayFactory: PaymentGatewayFactory,
    private readonly confirmHandler: ConfirmTicketOrderPaymentHandler,
    private readonly cancelHandler: CancelTicketOrderHandler,
  ) {}

  @Get('vnpay/ipn')
  async handleVnPayIpn(@Query() query: any, @Res() res: Response) {
    const gateway = this.gatewayFactory.get(PaymentGatewayEnum.VNPAY);
    const isValid = gateway.verifyWebhook({ ...query });
    if (!isValid) {
      this.logger.warn(`Ticket VNPAY IPN checksum failed: ${JSON.stringify(query)}`);
      return res.status(HttpStatus.OK).json({ RspCode: '97', Message: 'Fail checksum' });
    }

    const orderId = query['vnp_TxnRef'];
    const responseCode = query['vnp_ResponseCode'];
    const transactionStatus = query['vnp_TransactionStatus'];

    try {
      if (responseCode === '00' && (!transactionStatus || transactionStatus === '00')) {
        await this.confirmHandler.execute(new ConfirmTicketOrderPaymentCommand(orderId));
      } else {
        await this.cancelHandler.execute(new CancelTicketOrderCommand(orderId, 'CANCELLED'));
      }
      return res.status(HttpStatus.OK).json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (err) {
      this.logger.error(`Xử lý webhook thanh toán vé thất bại: ${(err as Error).message}`);
      return res.status(HttpStatus.OK).json({ RspCode: '99', Message: 'Unknown error' });
    }
  }
}
```

- [ ] **Step 4: Verify the project compiles**

Run: `bun run build`
Expected: succeeds

- [ ] **Step 5: Commit**

```bash
git add src/modules/ticket/application/dtos/create-ticket-order.dto.ts src/modules/ticket/presentation/controllers/ticket-order.controller.ts src/modules/ticket/presentation/controllers/ticket-order-webhook.controller.ts
git commit -m "feat(ticket): customer/merchant order controllers and payment webhook"
```

---

### Task 14: Expire stale pending orders (cron job)

**Files:**
- Create: `src/modules/ticket/infrastructure/jobs/expire-pending-ticket-orders.cron.ts`
- Test: `src/modules/ticket/infrastructure/jobs/expire-pending-ticket-orders.cron.spec.ts`

**Interfaces:**
- Consumes: `ITicketOrderRepository`/`TICKET_ORDER_REPOSITORY` (Task 6, specifically `findExpiredPending`), `CancelTicketOrderHandler` (Task 12).
- Produces: nothing consumed by later tasks — this is a leaf.

- [ ] **Step 1: Write the failing test**

```typescript
// src/modules/ticket/infrastructure/jobs/expire-pending-ticket-orders.cron.spec.ts
import { ExpirePendingTicketOrdersCron } from './expire-pending-ticket-orders.cron';

describe('ExpirePendingTicketOrdersCron', () => {
  const orderRepo = { findExpiredPending: jest.fn() } as any;
  const cancelHandler = { execute: jest.fn() } as any;
  const job = new ExpirePendingTicketOrdersCron(orderRepo, cancelHandler);

  beforeEach(() => jest.clearAllMocks());

  it('huỷ tất cả đơn PENDING quá 10 phút với finalStatus=EXPIRED', async () => {
    orderRepo.findExpiredPending.mockResolvedValueOnce([{ id: 'order-1' }, { id: 'order-2' }]);

    await job.handle();

    expect(cancelHandler.execute).toHaveBeenCalledTimes(2);
    expect(cancelHandler.execute.mock.calls[0][0]).toMatchObject({
      ticketOrderId: 'order-1',
      finalStatus: 'EXPIRED',
    });
  });

  it('không làm gì khi không có đơn nào hết hạn', async () => {
    orderRepo.findExpiredPending.mockResolvedValueOnce([]);

    await job.handle();

    expect(cancelHandler.execute).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/modules/ticket/infrastructure/jobs/expire-pending-ticket-orders.cron.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the cron job**

Uses `@nestjs/schedule`'s `@Cron` decorator — `ScheduleModule.forRoot()` is already registered globally in `src/app.module.ts`, so no extra module wiring is needed beyond providing this class.

```typescript
// src/modules/ticket/infrastructure/jobs/expire-pending-ticket-orders.cron.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ITicketOrderRepository,
  TICKET_ORDER_REPOSITORY,
} from '@/modules/ticket/domain/repositories/ticket-order.repository.interface';
import { CancelTicketOrderHandler } from '@/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.handler';
import { CancelTicketOrderCommand } from '@/modules/ticket/application/commands/cancel-ticket-order/cancel-ticket-order.command';

const PENDING_ORDER_TTL_MINUTES = 10;

@Injectable()
export class ExpirePendingTicketOrdersCron {
  private readonly logger = new Logger(ExpirePendingTicketOrdersCron.name);

  constructor(
    @Inject(TICKET_ORDER_REPOSITORY)
    private readonly orderRepo: ITicketOrderRepository,
    private readonly cancelHandler: CancelTicketOrderHandler,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handle(): Promise<void> {
    const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_MINUTES * 60 * 1000);
    const expiredOrders = await this.orderRepo.findExpiredPending(cutoff);

    for (const order of expiredOrders) {
      try {
        await this.cancelHandler.execute(new CancelTicketOrderCommand(order.id, 'EXPIRED'));
      } catch (err) {
        this.logger.error(`Không thể expire đơn vé ${order.id}: ${(err as Error).message}`);
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/modules/ticket/infrastructure/jobs/expire-pending-ticket-orders.cron.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/ticket/infrastructure/jobs/expire-pending-ticket-orders.cron.ts src/modules/ticket/infrastructure/jobs/expire-pending-ticket-orders.cron.spec.ts
git commit -m "feat(ticket): cron job to expire stale pending ticket orders"
```

---

### Task 15: Wire `TicketModule` into the app + oversell integration test

**Files:**
- Modify: `src/modules/ticket/ticket.module.ts` (fill in the shell from Task 1 with every provider/controller from Tasks 2–14)
- Modify: `src/app.module.ts` (import `TicketModule`)
- Test: `src/modules/ticket/infrastructure/persistence/typeorm/ticket-zone-quota.integration.spec.ts`

**Interfaces:**
- Consumes: everything produced by Tasks 1–14.
- Produces: nothing further — this is the final integration task for Phase 1.

- [ ] **Step 1: Fill in `TicketModule`**

```typescript
// src/modules/ticket/ticket.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentModule } from '../payment/payment.module';

import { TicketProductOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-product.orm-entity';
import { TicketZoneOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-zone.orm-entity';
import { TicketSessionOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-session.orm-entity';
import { TicketOrderOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-order.orm-entity';
import { TicketOrderLineOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-order-line.orm-entity';
import { TicketOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket.orm-entity';

import { TICKET_PRODUCT_REPOSITORY } from './domain/repositories/ticket-product.repository.interface';
import { TicketProductTypeormRepository } from './infrastructure/persistence/typeorm/ticket-product.typeorm.repository';
import { TICKET_ORDER_REPOSITORY } from './domain/repositories/ticket-order.repository.interface';
import { TicketOrderTypeormRepository } from './infrastructure/persistence/typeorm/ticket-order.typeorm.repository';
import { TICKET_REPOSITORY } from './domain/repositories/ticket.repository.interface';
import { TicketTypeormRepository } from './infrastructure/persistence/typeorm/ticket.typeorm.repository';

import { TicketAvailabilityService } from './infrastructure/redis/ticket-availability.service';
import { ExpirePendingTicketOrdersCron } from './infrastructure/jobs/expire-pending-ticket-orders.cron';

import { CreateTicketProductHandler } from './application/commands/create-ticket-product/create-ticket-product.handler';
import { PublishTicketProductHandler } from './application/commands/publish-ticket-product/publish-ticket-product.handler';
import { CreateTicketOrderHandler } from './application/commands/create-ticket-order/create-ticket-order.handler';
import { ConfirmTicketOrderPaymentHandler } from './application/commands/confirm-ticket-order-payment/confirm-ticket-order-payment.handler';
import { CancelTicketOrderHandler } from './application/commands/cancel-ticket-order/cancel-ticket-order.handler';
import { CancelPaidTicketOrderHandler } from './application/commands/cancel-paid-ticket-order/cancel-paid-ticket-order.handler';

import { MerchantTicketProductController } from './presentation/controllers/merchant-ticket-product.controller';
import {
  CustomerTicketOrderController,
  MerchantTicketOrderController,
} from './presentation/controllers/ticket-order.controller';
import { TicketOrderWebhookController } from './presentation/controllers/ticket-order-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TicketProductOrmEntity,
      TicketZoneOrmEntity,
      TicketSessionOrmEntity,
      TicketOrderOrmEntity,
      TicketOrderLineOrmEntity,
      TicketOrmEntity,
    ]),
    PaymentModule,
  ],
  controllers: [
    MerchantTicketProductController,
    CustomerTicketOrderController,
    MerchantTicketOrderController,
    TicketOrderWebhookController,
  ],
  providers: [
    TicketAvailabilityService,
    ExpirePendingTicketOrdersCron,
    CreateTicketProductHandler,
    PublishTicketProductHandler,
    CreateTicketOrderHandler,
    ConfirmTicketOrderPaymentHandler,
    CancelTicketOrderHandler,
    CancelPaidTicketOrderHandler,
    { provide: TICKET_PRODUCT_REPOSITORY, useClass: TicketProductTypeormRepository },
    { provide: TICKET_ORDER_REPOSITORY, useClass: TicketOrderTypeormRepository },
    { provide: TICKET_REPOSITORY, useClass: TicketTypeormRepository },
  ],
})
export class TicketModule {}
```

- [ ] **Step 2: Register `TicketModule` in `AppModule`**

Edit `src/app.module.ts`: add the import and add `TicketModule` to the `imports` array (after `IntegrationsModule`).

```typescript
import { TicketModule } from './modules/ticket/ticket.module';
```

```typescript
    IntegrationsModule,
    TicketModule,
```

- [ ] **Step 3: Verify the project compiles and boots**

Run: `bun run build`
Expected: succeeds

Run: `bun run start` (with a local Postgres + Redis reachable per `.env`), then Ctrl+C once you see `PostgreSQL connected successfully` and no `TicketModule`-related errors in the Nest dependency-injection log.

- [ ] **Step 4: Write the oversell integration test**

This test requires a real Postgres connection (the whole point is proving the conditional `UPDATE` prevents oversell under concurrency — mocks can't demonstrate that). It uses the same `dataSourceOptions` as the app, connecting to whatever DB the developer/CI has configured via `.env`, matching the convention already implied by `synchronize: true` in `src/infrastructure/database/data-source.ts`.

```typescript
// src/modules/ticket/infrastructure/persistence/typeorm/ticket-zone-quota.integration.spec.ts
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '@/infrastructure/database/data-source';
import { TicketZoneOrmEntity } from './entities/ticket-zone.orm-entity';
import { TicketProductOrmEntity } from './entities/ticket-product.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';

describe('TicketZone quota — chống oversell khi trừ quota đồng thời (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({ ...dataSourceOptions, synchronize: true });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('10 lệnh trừ 1 vé đồng thời trên zone chỉ còn 5 vé -> đúng 5 lệnh thành công', async () => {
    const merchantRepo = dataSource.getRepository(MerchantOrmEntity);
    const merchant = await merchantRepo.save(
      merchantRepo.create({ name: 'Merchant test', code: `test-${Date.now()}` } as any),
    );

    const productRepo = dataSource.getRepository(TicketProductOrmEntity);
    const product = await productRepo.save(
      productRepo.create({
        merchantId: merchant.uuid,
        name: 'Vé test oversell',
        priceAmount: 10000,
        priceCurrency: 'VND',
        validityType: 'DAY_PASS',
        usageType: 'UNLIMITED_USE',
        status: 'PUBLISHED',
      }),
    );

    const zoneRepo = dataSource.getRepository(TicketZoneOrmEntity);
    const zone = await zoneRepo.save(
      zoneRepo.create({ ticketProductId: product.uuid, name: 'DEFAULT', quota: 5 }),
    );

    const attempts = Array.from({ length: 10 }, () =>
      dataSource
        .createQueryBuilder()
        .update(TicketZoneOrmEntity)
        .set({ quota: () => 'quota - 1' })
        .where('uuid = :zoneId AND quota >= 1', { zoneId: zone.uuid })
        .execute(),
    );

    const results = await Promise.all(attempts);
    const successCount = results.filter((r) => r.affected === 1).length;

    expect(successCount).toBe(5);

    const finalZone = await zoneRepo.findOneOrFail({ where: { uuid: zone.uuid } });
    expect(finalZone.quota).toBe(0);
  });
});
```

- [ ] **Step 5: Run the integration test**

Run: `bun test src/modules/ticket/infrastructure/persistence/typeorm/ticket-zone-quota.integration.spec.ts`
Expected: PASS. If it fails to connect, ensure Postgres is running per the repo's local dev setup (check `.env`/`docker-compose.yml` if present) before treating this as a code bug.

- [ ] **Step 6: Run the full test suite**

Run: `bun test`
Expected: all tests pass (existing suite + every `ticket` module test added in Tasks 2–15).

- [ ] **Step 7: Commit**

```bash
git add src/modules/ticket/ticket.module.ts src/app.module.ts src/modules/ticket/infrastructure/persistence/typeorm/ticket-zone-quota.integration.spec.ts
git commit -m "feat(ticket): wire TicketModule into AppModule, add oversell integration test"
```
