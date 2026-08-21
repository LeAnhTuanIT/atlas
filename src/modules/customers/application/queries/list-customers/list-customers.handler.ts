import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListCustomersQuery } from './list-customers.query';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../../domain/repositories/customer.repository.interface';

@QueryHandler(ListCustomersQuery)
export class ListCustomersHandler implements IQueryHandler<ListCustomersQuery> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repo: ICustomerRepository,
  ) {}

  async execute(query: ListCustomersQuery) {
    const { merchantId, params } = query;
    const { data, total } = await this.repo.findPaginated(merchantId, params);

    return {
      data: data.map((c) => ({
        id: c.id.getValue(),
        fullName: c.fullName,
        phone: c.phone?.getValue(),
        email: c.email?.getValue(),
        status: c.status,
        loyaltyPoints: c.loyaltyPoints,
        createdAt: c.createdAt,
      })),
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }
}