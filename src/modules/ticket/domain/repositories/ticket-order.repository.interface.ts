import type { TicketOrder } from '../models/ticket-order.aggregate';

export interface ITicketOrderRepository {
  findById(id: string): Promise<TicketOrder | null>;
  findExpiredPending(olderThan: Date): Promise<TicketOrder[]>;
  save(order: TicketOrder): Promise<void>;
}

export const TICKET_ORDER_REPOSITORY = Symbol('ITicketOrderRepository');
