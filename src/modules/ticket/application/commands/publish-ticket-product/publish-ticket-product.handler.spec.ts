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
