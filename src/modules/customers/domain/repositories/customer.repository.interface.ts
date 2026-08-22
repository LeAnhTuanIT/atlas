import { Customer } from '../models/customer.model';
import { CustomerId } from '../value-objects/customer-id.vo';
import { PhoneNumber } from '../value-objects/phone.vo';
import { Email } from '../value-objects/email.vo';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

export interface CustomerFilterParams {
  cursor?: string;
  limit?: number;
  search?: string;
  status?: string;
}

export interface CustomerPaginatedResult {
  data: Customer[];
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface ICustomerRepository {
  save(customer: Customer): Promise<void>;
  saveMany(customers: Customer[]): Promise<void>;
  findById(merchantId: string, id: CustomerId): Promise<Customer | null>;
  findByPhone(merchantId: string, phone: PhoneNumber): Promise<Customer | null>;
  findByEmail(merchantId: string, email: Email): Promise<Customer | null>;
  findPaginated(
    merchantId: string,
    params: CustomerFilterParams,
  ): Promise<CustomerPaginatedResult>;
  findAll(merchantId: string): Promise<Customer[]>;
  delete(merchantId: string, id: CustomerId): Promise<void>;
}
