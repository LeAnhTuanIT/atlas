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
