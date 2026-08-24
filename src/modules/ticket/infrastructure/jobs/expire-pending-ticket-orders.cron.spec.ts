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
