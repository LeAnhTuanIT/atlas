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
