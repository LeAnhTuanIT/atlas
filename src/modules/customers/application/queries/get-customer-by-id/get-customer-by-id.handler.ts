import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetCustomerByIdQuery } from './get-customer-by-id.query';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../../domain/repositories/customer.repository.interface';
import { CustomerId } from '../../../domain/value-objects/customer-id.vo';

export interface CustomerDetailResponse {
  id: string;
  merchantId: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: string;
  loyaltyPoints: number;
  createdAt: Date;
  updatedAt: Date;
}

@QueryHandler(GetCustomerByIdQuery)
export class GetCustomerByIdHandler implements IQueryHandler<
  GetCustomerByIdQuery,
  CustomerDetailResponse
> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(query: GetCustomerByIdQuery): Promise<CustomerDetailResponse> {
    const { merchantId, id } = query;
    const customerId = new CustomerId(id);

    const customer = await this.customerRepository.findById(
      merchantId,
      customerId,
    );
    if (!customer) {
      throw new NotFoundException(`Không tìm thấy khách hàng với ID: ${id}`);
    }

    return {
      id: customer.id.getValue(),
      merchantId: customer.merchantId,
      fullName: customer.fullName,
      phone: customer.phone?.getValue(),
      email: customer.email?.getValue(),
      status: customer.status,
      loyaltyPoints: customer.loyaltyPoints,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
