# Spec: Module `integrations` — Zalo OA (liên kết, xem, đồng bộ tin nhắn, gửi tin)

Ngày: 2026-08-23
Trạng thái: Approved cho implementation

## 1. Bối cảnh & mục tiêu

Hệ thống cần cho phép **merchant** tự liên kết Official Account (OA) Zalo của họ với
tài khoản merchant trong Atlas, để:

- Xem trạng thái/thông tin OA đã liên kết.
- Đồng bộ (nhận) tin nhắn người dùng gửi đến OA qua webhook.
- Gửi tin nhắn (OA message / ZNS) từ hệ thống ra Zalo.

Module được đặt tên `integrations` (không phải `zalo-oa`) vì hệ thống sẽ mở rộng
kết nối thêm các vendor khác trong tương lai (ví dụ eSMS/Vihat để gửi SMS). Vendor
đầu tiên và duy nhất cần code thật trong phạm vi này là **Zalo OA**; phần chung
(interface gửi tin nhắn) được thiết kế sẵn để vendor sau cắm vào mà không phải sửa
lại domain/application layer.

Tài liệu OAuth tham chiếu: Zalo OA Developers — "Xác thực và Ủy quyền" (ảnh người
dùng cung cấp), mô tả 2 bước chính: (1) redirect người dùng sang trang cấp quyền
Zalo để lấy `authorization code`, (2) server đổi `code` lấy `access_token` +
`refresh_token`, và phương thức refresh token khi access token hết hạn.

## 2. Phạm vi

### Trong phạm vi
- Flow OAuth liên kết OA cho merchant (connect-url → Zalo → callback → lưu token).
- Refresh access_token bằng refresh_token khi hết hạn (lazy refresh trước khi gọi API).
- Endpoint xem trạng thái liên kết.
- Webhook nhận sự kiện tin nhắn đến / follow-unfollow từ Zalo, lưu đồng bộ vào DB.
- Endpoint xem danh sách tin nhắn đã đồng bộ (phân trang).
- Endpoint gửi tin nhắn (OA message) tới 1 người dùng Zalo.
- Interface dùng chung (`IMessagingGateway`, `IOAuthConnectable`) + factory, để
  vendor khác (eSMS) implement sau này mà không phải sửa application/domain layer.

### Ngoài phạm vi (task sau)
- Implement thật gateway eSMS/Vihat (chỉ chuẩn bị interface).
- Mã hóa `access_token`/`refresh_token` tại rest (hiện lưu plain text trong DB,
  nhất quán với cách các secret khác trong hệ thống — vd `MOMO_SECRET_KEY` — đang
  được quản lý qua env/DB không mã hóa).
- Catalog/quản lý mẫu ZNS template.
- Multi-OA cho 1 merchant (giả định 1 merchant ↔ 1 OA đang hoạt động tại 1 thời điểm;
  liên kết mới sẽ ghi đè liên kết cũ của cùng merchant+provider).

## 3. Kiến trúc

```
src/modules/integrations/
  domain/
    models/
      integration-connection.aggregate.ts
      zalo-oa-message.entity.ts
    repositories/
      integration-connection.repository.interface.ts
      zalo-oa-message.repository.interface.ts
    services/
      messaging-gateway.interface.ts
      oauth-connectable.interface.ts
    value-objects/
      integration-provider.vo.ts
      integration-status.vo.ts
  application/
    commands/
      link-zalo-oa/{link-zalo-oa.command.ts,link-zalo-oa.handler.ts}
      send-zalo-oa-message/{send-zalo-oa-message.command.ts,send-zalo-oa-message.handler.ts}
      sync-zalo-oa-webhook-event/{sync-zalo-oa-webhook-event.command.ts,sync-zalo-oa-webhook-event.handler.ts}
    queries/
      get-integration-status/{get-integration-status.query.ts,get-integration-status.handler.ts}
      list-zalo-oa-messages/{list-zalo-oa-messages.query.ts,list-zalo-oa-messages.handler.ts}
    dtos/
      send-zalo-oa-message.dto.ts
      list-zalo-oa-messages.dto.ts
  infrastructure/
    gateways/
      zalo-oa.gateway.ts
      integration-gateway.factory.ts
    persistence/
      entities/
        integration-connection.orm-entity.ts
        zalo-oa-message.orm-entity.ts
      repositories/
        typeorm-integration-connection.repository.ts
        typeorm-zalo-oa-message.repository.ts
  presentation/http/
    zalo-oa.controller.ts
    zalo-oa-webhook.controller.ts
  integrations.module.ts
```

Theo pattern module `payment` hiện có (`IPaymentGateway` + `PaymentGatewayFactory`,
tách controller webhook riêng khỏi controller nghiệp vụ, entity kế thừa
`BaseOrmEntity`, dùng `ConfigService.getOrThrow` cho secret bắt buộc, log lỗi bằng
`Logger` của Nest thay vì `console.log`).

## 4. Domain model

### `IntegrationConnection` (aggregate)
Đại diện 1 liên kết vendor ↔ merchant.

| Field | Kiểu | Ghi chú |
|---|---|---|
| id/uuid | kế thừa `BaseOrmEntity` | |
| merchantId | uuid | FK → `merchant` |
| provider | enum `IntegrationProviderEnum` (`ZALO_OA`, `ESMS`) | |
| externalId | string | `oa_id` của Zalo (định danh OA trên Zalo) |
| status | enum `IntegrationStatusEnum` (`ACTIVE`, `EXPIRED`, `REVOKED`) | |
| accessToken | text, nullable | |
| refreshToken | text, nullable | |
| tokenExpiresAt | timestamptz, nullable | |
| metadata | jsonb, nullable | tên OA, avatar... trả về từ Zalo |

Unique index `(merchantId, provider)` — 1 merchant chỉ có 1 connection active cho
mỗi provider; liên kết lại sẽ update record cũ (không tạo mới).

### `ZaloOaMessage` (entity, chỉ dùng cho Zalo)
| Field | Kiểu | Ghi chú |
|---|---|---|
| id/uuid | kế thừa `BaseOrmEntity` | |
| connectionId | uuid | FK → `integration_connection` |
| direction | enum (`IN`, `OUT`) | `IN` = user gửi đến OA (webhook), `OUT` = OA gửi đi |
| zaloUserId | string | định danh người dùng Zalo |
| content | text | |
| messageType | string | `text`, `image`, ... (lưu raw type từ Zalo) |
| externalMessageId | string, nullable | msg_id Zalo trả về (dùng chống trùng khi webhook retry) |
| sentAt | timestamptz | |

Unique index `(connectionId, externalMessageId)` khi `externalMessageId` không null,
để idempotent khi Zalo gửi lại webhook trùng.

## 5. Interfaces dùng chung

```ts
// domain/services/messaging-gateway.interface.ts
export interface SendMessageParams {
  connectionId: string;
  to: string;           // định danh người nhận (zaloUserId, số điện thoại...)
  content: string;
  type?: string;         // 'text' | 'zns' | ...
}
export interface SendMessageResult {
  externalMessageId: string;
}
export interface IMessagingGateway {
  getProvider(): IntegrationProviderEnum;
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
}

// domain/services/oauth-connectable.interface.ts
export interface IOAuthConnectable {
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<ExchangedToken>;
  refreshAccessToken(refreshToken: string): Promise<ExchangedToken>;
}
export interface ExchangedToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // giây
}
```

`oa_id` **không** nằm trong response của `exchangeCode` — theo flow OAuth thật của
Zalo, `oa_id` được Zalo đính kèm trực tiếp vào query string khi redirect về callback
(`GET .../callback?code=...&oa_id=...&state=...`), tách biệt với token response. Vì
vậy `LinkZaloOaCommand` nhận `oaId` như một tham số riêng (từ query callback), không
lấy từ `ExchangedToken`.

`ZaloOaGateway` implement cả hai interface. `IntegrationGatewayFactory.getMessagingGateway(provider)`
trả về gateway tương ứng (giống `PaymentGatewayFactory`); khi thêm `EsmsGateway` sau
này chỉ cần đăng ký thêm nhánh trong factory.

## 6. Luồng OAuth liên kết

1. `GET /v1/merchant/integrations/zalo-oa/connect-url` (MerchantAuthGuard) — handler
   tạo `state` = JWT ký bằng `ZALO_OA_STATE_SECRET`, payload `{ merchantId, exp: +5min }`.
   Trả về `{ url: gateway.getAuthUrl(state) }`.
2. Merchant được redirect sang Zalo, duyệt quyền.
3. Zalo redirect về `GET /v1/integrations/zalo-oa/callback?code=...&oa_id=...&state=...`
   (public, không guard). Handler:
   - Verify + decode `state` → lấy `merchantId`. Sai/hết hạn → redirect về
     `APP_BASE_URL/.../zalo-oa?status=error&reason=invalid_state`.
   - Gọi `gateway.exchangeCode(code)` → nhận `accessToken/refreshToken/expiresIn/externalId(oa_id)`.
   - Upsert `IntegrationConnection` (merchantId, provider=ZALO_OA).
   - Redirect merchant về `APP_BASE_URL/.../zalo-oa?status=success`.
4. Lỗi gọi Zalo API (exchange thất bại) → redirect `status=error&reason=exchange_failed`,
   log chi tiết bằng `Logger.error`, không throw ra response (vì đây là redirect từ
   trình duyệt, không có ai đọc JSON lỗi).

## 7. Luồng refresh token

`ZaloOaGateway.sendMessage()` (và các call API khác) trước khi gọi:
- Lấy `IntegrationConnection` theo `connectionId`.
- Nếu `tokenExpiresAt` còn < 5 phút → gọi `refreshAccessToken(refreshToken)`,
  update lại `accessToken/refreshToken/tokenExpiresAt` trong DB, rồi mới gọi API gửi tin.
- Nếu refresh thất bại (refresh_token cũng hết hạn) → set `status = EXPIRED`,
  throw lỗi nghiệp vụ rõ ràng để FE báo merchant liên kết lại.

## 8. Luồng webhook đồng bộ tin nhắn

- `POST /v1/integrations/zalo-oa/webhook` — public, verify chữ ký trước khi xử lý:
  Zalo ký request bằng `mac` field trong body, công thức
  `HMAC_SHA256(secretKey, appId + JSON(data) + timestamp)` (chốt chính xác theo
  Zalo OA webhook docs khi code — tương tự cách `MoMoGateway.verifyWebhook` đang làm).
  Verify sai → trả `200 OK` rỗng (Zalo yêu cầu luôn trả 200 để tránh retry bão), chỉ
  log warning, **không** xử lý tiếp.
- Payload hợp lệ → map theo `event_name`:
  - `user_send_text` / `user_send_image` / ... → `SyncZaloOaWebhookEventCommand`:
    tìm `IntegrationConnection` theo `oa_id` trong payload → insert `ZaloOaMessage`
    (direction=IN), bỏ qua nếu `externalMessageId` đã tồn tại (idempotent).
  - `follow` / `unfollow` → ghi log, cập nhật `metadata` của connection (không bắt
    buộc phải lưu bảng riêng trong phạm vi này).
  - Event không nhận diện → log và bỏ qua.
- Webhook luôn trả `200 OK` ngay cả khi xử lý nội bộ lỗi (để tránh Zalo retry vô hạn),
  lỗi được log lại qua `Logger.error`.

## 9. API cho merchant

| Method | Path | Guard | Body/Query | Response |
|---|---|---|---|---|
| GET | `/v1/merchant/integrations/zalo-oa/connect-url` | Merchant | — | `{ url }` |
| GET | `/v1/integrations/zalo-oa/callback` | Public | `code, oa_id, state` | 302 redirect |
| POST | `/v1/integrations/zalo-oa/webhook` | Public (verify signature) | raw Zalo event | `200 OK` |
| GET | `/v1/merchant/integrations/zalo-oa/status` | Merchant | — | `{ connected, oaId, status, metadata }` |
| GET | `/v1/merchant/integrations/zalo-oa/messages` | Merchant | `cursor?, limit?` | danh sách `ZaloOaMessage` phân trang |
| POST | `/v1/merchant/integrations/zalo-oa/messages` | Merchant | `{ to, content, type? }` | `{ externalMessageId }` |

Guard `MerchantAuthGuard` lấy `merchantId` từ `req.user.merchantId` (payload JWT có
sẵn field này — không cần parse cookie thủ công như `PaymentController` đang làm).

## 10. Cấu hình env

Thêm vào `src/infrastructure/configs/env.validation.ts`:

```ts
ZALO_OA_APP_ID: z.string().min(1),
ZALO_OA_SECRET_KEY: z.string().min(1),
ZALO_OA_REDIRECT_URI: z.string().min(1),
ZALO_OA_STATE_SECRET: z.string().min(1),
```

(Webhook dùng chung `ZALO_OA_SECRET_KEY` để verify chữ ký, trừ khi tài liệu Zalo yêu
cầu khóa riêng — sẽ xác nhận khi code phần này.)

## 11. Xử lý lỗi

- Lỗi validate input (DTO) → `BadRequestException` chuẩn của Nest/class-validator.
- Chưa liên kết OA mà gọi gửi tin/xem status → trả `{ connected: false }` (status) hoặc
  `NotFoundException` (gửi tin) thay vì lỗi 500.
- Lỗi gọi Zalo API (network/4xx/5xx từ Zalo) → log chi tiết response Zalo trả về
  (giống `MoMoGateway`), throw `BadGatewayException` với message tiếng Việt rõ ràng
  cho FE hiển thị.
- `GlobalExceptionFilter` có sẵn trong `shared/infrastructure/filters` sẽ bắt các
  exception còn lại — không cần thêm filter riêng.

## 12. Testing

- Unit test cho `LinkZaloOaHandler`, `SendZaloOaMessageHandler`,
  `SyncZaloOaWebhookEventHandler` — mock `IMessagingGateway`/`IOAuthConnectable` và
  repository, theo pattern các handler test hiện có trong `payment`/`auth` module
  (kiểm tra file test hiện có trước khi viết để giữ đúng convention mock/assert).
- Test verify chữ ký webhook (case đúng/sai).
- Test idempotent khi webhook gửi trùng `externalMessageId`.
- Không viết integration test gọi Zalo API thật (không có sandbox credentials trong
  môi trường dev/test).

## 13. Migration/DB

`synchronize: true` đang bật ở `data-source.ts` (dev) — 2 bảng mới
(`integration_connection`, `zalo_oa_message`) sẽ tự tạo, không cần viết migration
thủ công, nhất quán với cách các entity khác trong repo đang hoạt động.
