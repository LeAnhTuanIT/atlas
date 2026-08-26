# Auth cho Customer từ Zalo Mini App — hợp nhất identity với Website

Ngày: 2026-08-26

## Bối cảnh

Hệ thống hiện có `UnifiedLoginCommand` (module `auth`) xử lý đăng nhập theo 3 scope: `SYSTEM`, `MERCHANT`, `CUSTOMER`, dùng `identifier + password`, sinh JWT qua `TOKEN_GENERATOR_PORT` và set cookie theo scope (`CookieUtil`, `COOKIE_KEYS`).

`CustomerOrmEntity` đã có sẵn cột `zaloUid` (chưa unique) và unique index theo `(merchantId, phone)` / `(merchantId, email)` — mô hình multi-tenant: mỗi `Customer` thuộc về đúng 1 `merchantId`.

Yêu cầu: cho phép customer đăng nhập từ Zalo Mini App (`root` project, `zmp-ui`), và đảm bảo **cùng một customer** dù đăng nhập từ Mini App hay từ website (customer-facing website sẽ xây dựng sau, dùng chung API auth này). Website customer-facing hiện **chưa tồn tại** trong repo — `apollo` là dashboard merchant/admin, không liên quan tới flow này.

Mô hình triển khai Mini App: **mỗi merchant có 1 Zalo Mini App riêng** (App ID/Secret riêng biệt), Mini App ID/App ID/App Secret đã có sẵn, sẵn sàng cấu hình.

## Ba định danh Zalo cần phân biệt

| Tên | Ý nghĩa | Public/Secret |
|---|---|---|
| `zaloMiniAppId` | ID của chính Mini App (trong `app-config.json` khi build) | Public |
| `zaloAppId` | ID của "Application" đăng ký trên Zalo Developers mà Mini App được gắn vào, dùng cho Open API | Public |
| `zaloAppSecret` | Secret key thuộc về `zaloAppId`, dùng để gọi API cần xác thực (giải mã SĐT) | Secret — mã hoá at-rest |

## Kiến trúc

Thêm 1 route mới, tách biệt hoàn toàn khỏi `UnifiedLoginCommand` (input/logic khác nhau — token verification qua Zalo, không phải so khớp password):

```
Zalo Mini App (root, zmp-ui)
   │  hook useZaloAuth(): getUserInfo() + getAccessToken() + getPhoneNumber()
   ▼
POST /v1/auth/zalo-miniapp/login
   { zaloMiniAppId, uid, accessToken, phoneToken }
   ▼
ZaloMiniAppLoginHandler (CQRS command, module auth, cùng AuthController)
   1. ResolveZaloMiniAppConnectionService.resolveByMiniAppId(zaloMiniAppId)
      → { merchantId, zaloAppId, zaloAppSecret } (NotFoundException nếu không có)
   2. Kiểm tra merchant.status === ACTIVE (ForbiddenException nếu không)
   3. ZaloMiniAppGateway.getProfile(accessToken)
      → GET graph.zalo.me/v2.0/me?access_token=...&fields=id,name,picture
      → { realUid, name, avatar } (UnauthorizedException nếu accessToken invalid)
   4. So khớp uid (client gửi) === realUid (Zalo trả) — mismatch → UnauthorizedException + log cảnh báo
   5. ZaloMiniAppGateway.getPhoneNumber(accessToken, phoneToken, zaloAppSecret)
      → GET graph.zalo.me/v2.0/me/info?access_token=...&code=phoneToken&secret_key=...
      → phone thật (UnauthorizedException nếu phoneToken hết hạn/sai)
   6. Chuẩn hoá phone qua PhoneNumber VO
   7. Phân giải Customer (dùng realUid, không dùng uid client gửi):
      a. findByMerchantAndZaloUid(merchantId, realUid) → dùng luôn nếu có
      b. else findByPhone(merchantId, phone):
         - có, chưa có zaloUid → auto-link (set zaloUid = realUid, save)
         - có, đã có zaloUid KHÁC → ConflictException (không tự ghi đè)
      c. else tạo Customer mới { merchantId, phone, zaloUid: realUid,
         fullName: <tên Zalo>, status: ACTIVE }
      d. Duplicate-key do race condition (unique index vi phạm) → catch, re-fetch, tiếp tục
   8. Nếu customer.status === BLOCKED → ForbiddenException
   9. tokenGenerator.generateTokens({ sub: customer.id, phoneOrEmail: phone,
      scope: 'CUSTOMER', merchantId }) — TÁI DÙNG nguyên TOKEN_GENERATOR_PORT
   ▼
AuthController set cookie CUSTOMER_ACCESS/CUSTOMER_REFRESH (CookieUtil có sẵn,
logic y hệt route /auth/login hiện tại cho scope CUSTOMER)
```

Từ bước 9 trở đi, Mini App và website tương lai dùng chung cookie, chung `CustomerJwtStrategy`, chung customer record.

## Thay đổi Data model

**`CustomerOrmEntity`:**
- Thêm unique partial index: `(merchantId, zaloUid) WHERE zalo_uid IS NOT NULL` (migration TypeORM mới).

**`IntegrationConnection` (module `integrations`):**
- Thêm giá trị `ZALO_MINI_APP` vào `IntegrationProvider` value-object.
- Config lưu cho provider này: `zaloMiniAppId`, `zaloAppId`, `zaloAppSecret` (mã hoá at-rest theo cơ chế đã dùng cho Zalo OA token).
- Unique index trên `zaloMiniAppId`.
- 1 merchant có tối đa 1 `IntegrationConnection` với `provider = ZALO_MINI_APP`.

Không cần bảng mới — tái dùng toàn bộ 2 entity đã có.

## Thành phần code mới (atlas)

- `modules/auth/application/dtos/zalo-miniapp-login.dto.ts`
- `modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.command.ts`
- `modules/auth/application/commands/zalo-miniapp-login/zalo-miniapp-login.handler.ts`
- `modules/integrations/infrastructure/gateways/zalo-miniapp.gateway.ts` (tương tự `zalo-oa.gateway.ts`)
- `modules/integrations/application/services/resolve-zalo-miniapp-connection.service.ts` (tương tự `resolve-zalo-oa-connection.service.ts`)
- Route mới `POST /v1/auth/zalo-miniapp/login` thêm vào `AuthController` hiện có
- Migration: unique partial index cho `zaloUid`, mở rộng enum `IntegrationProvider`

## Thành phần code mới (root, zmp-ui)

- `src/.../hooks/useZaloAuth.ts` — chỉ lấy dữ liệu từ zmp-sdk (`getUserInfo`, `getAccessToken`, `getPhoneNumber`), không gọi API backend
- Service/hook riêng gọi `POST /v1/auth/zalo-miniapp/login` với kết quả từ `useZaloAuth`

## Xử lý lỗi & Edge case

| Tình huống | Xử lý |
|---|---|
| `zaloMiniAppId` không resolve được merchant | `NotFoundException` |
| `accessToken` sai/hết hạn | `UnauthorizedException` |
| `uid` FE gửi ≠ `realUid` Zalo trả về | `UnauthorizedException`, log cảnh báo giả mạo |
| User từ chối quyền SĐT | Chặn ở FE; nếu vẫn gửi `phoneToken` rỗng → `BadRequestException` |
| `phoneToken` hết hạn/giải mã lỗi | `UnauthorizedException` |
| Trùng `phone` nhưng khác `zaloUid` đã có | `ConflictException`, không tự ghi đè |
| Race condition tạo/link trùng `zaloUid` hoặc `phone` | Catch duplicate-key → re-fetch → tiếp tục thành công |
| Zalo Graph API lỗi hạ tầng/timeout | `ServiceUnavailableException`, không leak lỗi thô, log chi tiết server |
| Merchant không `ACTIVE` | `ForbiddenException` |
| Customer `BLOCKED` | `ForbiddenException` |

## Testing

- Unit test `ZaloMiniAppLoginHandler`: đủ các nhánh ở bảng edge-case trên (mock gateway, resolve service, repository, token generator).
- Unit test `ZaloMiniAppGateway`: parse response thành công + map lỗi Zalo thành exception nội bộ (mock HTTP client).
- Unit test `ResolveZaloMiniAppConnectionService`: resolve đúng/lỗi khi thiếu cấu hình.
- E2E (`atlas/test`): toàn bộ flow `POST /v1/auth/zalo-miniapp/login` với gateway mock (không gọi Zalo thật), kiểm tra cookie set đúng, response shape khớp `/auth/login` scope CUSTOMER; test migration unique partial index.
- FE: test `useZaloAuth` với mock `zmp-sdk`.

## Ngoài phạm vi (out of scope)

- Xây dựng website customer-facing thực tế (chỉ đảm bảo API auth sẵn sàng dùng chung khi website đó ra đời).
- Bổ sung check `customer.status` vào `UnifiedLoginHandler` hiện tại (không đụng code cũ ngoài phạm vi flow Zalo).
