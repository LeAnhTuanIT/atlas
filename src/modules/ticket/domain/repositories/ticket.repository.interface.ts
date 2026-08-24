import type { Ticket } from '../models/ticket.aggregate';

export interface ITicketRepository {
  findByOrderId(orderId: string): Promise<Ticket[]>;
  saveMany(tickets: Ticket[]): Promise<void>;
}

export const TICKET_REPOSITORY = Symbol('ITicketRepository');
