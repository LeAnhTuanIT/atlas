# Ticket Selling — Giai đoạn 1: Tạo vé & Bán vé

Ngày: 2026-08-24
Trạng thái: Đã duyệt thiết kế, chờ viết implementation plan

## 1. Bối cảnh & phạm vi

Merchant cần tạo và bán nhiều loại vé cho khách: vé sự kiện theo ngày/theo suất/theo giờ, vé khu vui chơi
(1 vé dùng nhiều trò chơi), vé theo zone cho sự kiện ca nhạc (không phân ghế, chỉ giới hạn số lượng theo
từng khu).

**Giai đoạn 1 (spec này)** chỉ bao gồm: merchant tạo loại vé → khách mua vé (online qua app hoặc merchant
bán trực tiếp tại quầy) → vé được phát hành (issued). **Không bao gồm** engine soát vé QR / check-in / trừ
lượt sử dụng thực tế tại cổng — đó là Giai đoạn 2, sẽ brainstorm riêng sau khi Giai đoạn 1 hoàn thành. Domain
model của giai đoạn 1 chuẩn bị sẵn các thuộc tính cần thiết (trạng thái vé, số lượt còn lại) để giai đoạn 2
không phải thiết kế lại.

Tất cả các loại vé được mô tả đều quy về 2 trục biến thiên chung: **quy tắc hiệu lực theo thời gian**
(validity rule) và **quy tắc sử dụng** (usage rule), cộng với khái niệm **zone** có quota riêng. Vì vậy thiết
kế dùng một mô hình thống nhất thay vì tạo entity riêng cho từng loại vé (event ticket, playground ticket,
zone ticket...) — tránh trùng lặp logic quota/session và dễ mở rộng loại vé mới sau này.

## 2. Domain Model

Module mới: `src/modules/ticket/` theo đúng pattern DDD hiện có trong repo (domain / application /
infrastructure / presentation), tương tự cấu trúc của `payment`, `merchant`, `entitlement`.

### 2.1 TicketProduct (aggregate root)

Sản phẩm vé do merchant tạo.

- `id, merchantId, name, description, priceAmount, priceCurrency`
- `validityRule`: `{ type: 'DAY_PASS' }` | `{ type: 'SESSION' }`
- `usageRule`: `{ type: 'UNLIMITED_USE' }` | `{ type: 'LIMITED_USE', maxUses: number }`
- `zones: TicketZone[]` — mỗi zone: `{ id, name, quota }`. Vé không phân zone dùng 1 zone mặc định
  (`DEFAULT`, ẩn khỏi UI khách hàng).
- `status`: `DRAFT` | `PUBLISHED` | `ARCHIVED` — chỉ vé `PUBLISHED` mới bán được.

### 2.2 TicketSession (entity con của TicketProduct)

Khung thời gian hiệu lực cụ thể của một đợt bán.

- `id, ticketProductId, startAt, endAt`
- `DAY_PASS` → `startAt`/`endAt` là 00:00–23:59 của ngày cụ thể.
- `SESSION` → khung giờ cố định do merchant đặt (ví dụ suất 14:00–16:00). "Vé theo giờ" và "vé theo suất" là
  cùng một khái niệm ở tầng domain.
- Một `TicketProduct` có thể có nhiều `TicketSession` (nhiều suất/nhiều ngày).

### 2.3 TicketOrder (aggregate root)

Đơn mua vé, có thể gồm nhiều dòng (nhiều loại vé/số lượng trong 1 lần mua).

- `id, channel: ONLINE | COUNTER, buyerId (customerId, null cho COUNTER), merchantId`
- `status`: `PENDING` | `PAID` | `CANCELLED` | `EXPIRED`
- `lines: TicketOrderLine[]` — mỗi line: `{ ticketProductId, ticketSessionId, zoneId, quantity, unitPrice }`
- `paymentOrderId` — liên kết sang `payment` module (`PaymentOrder`), `null` với đơn bán tại quầy.

### 2.4 Ticket (aggregate root)

Vé đã phát hành cho khách sau khi order thành công.

- `id, code` (mã vé duy nhất, dùng làm nội dung QR ở Giai đoạn 2)
- `ticketOrderId, ticketProductId, ticketSessionId, zoneId`
- `status`: `ISSUED` | `CANCELLED` (chưa có `USED`/`PARTIALLY_USED` — để dành Giai đoạn 2)
- `remainingUses: number | null` — `null` nếu unlimited-use; có giá trị nếu `LIMITED_USE`. Chuẩn bị sẵn cho
  Giai đoạn 2, không được trừ trong giai đoạn này.

### 2.5 Domain service

`TicketAvailabilityService` — kiểm tra và giữ/nhả quota theo `(ticketSessionId, zoneId)`. Nguồn chân lý cuối
cùng của quota luôn là cột `quota` trong bảng `ticket_zone` (Postgres), Redis chỉ dùng để giữ chỗ tạm thời
trong lúc khách đang thanh toán (xem mục 3).

## 3. Data Flow

### 3.1 Merchant tạo vé

`CreateTicketProductCommand` — merchant nhập tên, giá, validity rule, usage rule, danh sách zone + quota.
Handler tạo `TicketProduct` (status `DRAFT`), có thể tạo kèm 1+ `TicketSession`.
`PublishTicketProductCommand` chuyển `TicketProduct` sang `PUBLISHED`.

### 3.2 Khách mua vé — kênh online

`CreateTicketOrderCommand` (channel = `ONLINE`):

1. Kiểm tra `TicketProduct` đang `PUBLISHED` và `TicketSession` còn hiệu lực (`now < endAt`). Nếu không →
   `TicketNotAvailableException`.
2. `TicketAvailabilityService.reserve(sessionId, zoneId, quantity)` — giữ chỗ tạm thời trong Redis, key
   `ticket:reserve:{sessionId}:{zoneId}`, TTL 10 phút, giảm bằng Lua script atomic (kiểm tra không âm trước
   khi trừ). Không đủ quota → `InsufficientTicketQuotaException`, không tạo order.
3. Tạo `TicketOrder` (`PENDING`), tạo `PaymentOrder` bên module `payment` qua interface hiện có, trả về
   thông tin thanh toán cho FE.
4. Khi `payment` module báo thanh toán thành công (event/webhook) →
   `TicketOrderPaymentConfirmedHandler`, trong 1 TypeORM transaction:
   - `UPDATE ticket_zone SET quota = quota - :quantity WHERE id = :zoneId AND quota >= :quantity` (atomic,
     là bước chống oversell thật sự).
   - Tạo các bản ghi `Ticket` (status `ISSUED`, sinh `code` duy nhất).
   - `TicketOrder.status = PAID`.
   - Xoá reservation key Redis tương ứng.
5. Job định kỳ (`bullmq`) quét `TicketOrder` `PENDING` quá TTL chưa thanh toán → chuyển `EXPIRED`. Reservation
   Redis tự hết hạn theo TTL nên không cần nhả tay.

### 3.3 Merchant bán tại quầy

`CreateTicketOrderCommand` (channel = `COUNTER`): giống bước 1–2 ở trên nhưng bỏ qua bước tạo `PaymentOrder`.
Merchant xác nhận thu tiền qua `ConfirmCounterPaymentCommand`, chạy thẳng logic ở bước 4 (trừ quota thật,
phát hành `Ticket`, `TicketOrder.status = PAID`) ngay lập tức, không chờ webhook.

### 3.4 Nhất quán quota giữa Redis (soft-hold) và DB (hard quota)

Redis chỉ chặn tại thời điểm đặt chỗ để tránh nhiều người cùng giữ vượt quota trong lúc chờ thanh toán. Quota
"thật" luôn là cột `quota` trong bảng `ticket_zone`, trừ bằng `UPDATE ... WHERE quota >= :quantity` trong
transaction — nên dù Redis lệch (crash, mất kết nối) DB vẫn không bao giờ bán vượt số lượng.

## 4. Error Handling

| Tình huống | Xử lý |
|---|---|
| Hết quota lúc đặt chỗ | `InsufficientTicketQuotaException` → API 409, không tạo `TicketOrder` |
| Session đã qua `endAt` / `TicketProduct` không `PUBLISHED` | `TicketNotAvailableException`, reject trước khi chạm Redis |
| Khách bỏ dở thanh toán quá TTL | Job `bullmq` chuyển `TicketOrder` → `EXPIRED`; Redis reservation tự hết hạn theo TTL, quota nhả lại tự nhiên |
| Thanh toán thất bại | `TicketOrderPaymentFailedHandler` chuyển `TicketOrder` → `CANCELLED` ngay, xoá reservation Redis sớm để trả quota ngay cho người khác |
| Merchant huỷ `TicketOrder` đã `PAID` (hoàn tiền) | `CancelTicketOrderCommand` — các `Ticket` liên quan → `CANCELLED`, cộng lại `quota` thật trong transaction; việc hoàn tiền gọi sang `payment` module xử lý riêng, ngoài phạm vi module `ticket` |
| Race condition trừ quota thật đồng thời | `UPDATE ... WHERE quota >= :quantity` trong 1 transaction — Postgres đảm bảo atomic, không cần lock ứng dụng |
| Redis down khi đang giữ chỗ | Fallback đọc quota thật trực tiếp từ DB; bước trừ quota thật ở bước thanh toán vẫn là nguồn chân lý cuối cùng nên không oversell dù Redis tạm thời không khả dụng |

## 5. Testing

- **Domain unit test:** `TicketProduct` (validate zone/quota, chuyển trạng thái draft/publish), `Ticket`
  (issue, cancel), `TicketAvailabilityService` (reserve/release, mock Redis client).
- **Application handler test:** `CreateTicketOrderCommand` (cả 2 kênh online/counter),
  `TicketOrderPaymentConfirmedHandler` (đúng số `Ticket` được issue, quota giảm đúng).
- **Integration test (DB thật, không mock):** giả lập 2 lệnh trừ quota đồng thời để xác nhận không oversell;
  1 luồng end-to-end mua vé online từ tạo order → xác nhận thanh toán → vé được issue.
- Không test QR/soát vé trong giai đoạn này (ngoài phạm vi).

## 6. Ngoài phạm vi (Giai đoạn 2 — brainstorm riêng sau)

- Engine soát vé QR: quét tại cổng, quét tại từng trạm trò chơi, trừ `remainingUses`, lịch sử soát vé.
- Hoàn tiền tự động khi huỷ vé (hiện tại chỉ trigger sang `payment` module, chưa thiết kế chi tiết).
