import type { TicketProduct } from '../models/ticket-product.aggregate';

export interface ITicketProductRepository {
  findById(id: string): Promise<TicketProduct | null>;
  findPublishedById(id: string): Promise<TicketProduct | null>;
  save(product: TicketProduct): Promise<void>;
}

export const TICKET_PRODUCT_REPOSITORY = Symbol('ITicketProductRepository');
