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
