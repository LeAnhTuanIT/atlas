import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ExportCustomersQuery } from './export-customers.query';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../../domain/repositories/customer.repository.interface';

@QueryHandler(ExportCustomersQuery)
export class ExportCustomersHandler implements IQueryHandler<ExportCustomersQuery> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly repo: ICustomerRepository,
  ) {}

  async execute(query: ExportCustomersQuery) {
    const customers = await this.repo.findAll(query.merchantId);

    // Xuất CSV đơn giản (nếu muốn xlsx dùng thư viện `exceljs`)
    const header =
      'ID,Full Name,Phone,Email,Status,Loyalty Points,Created At\n';
    const rows = customers
      .map(
        (c) =>
          `"${c.id.getValue()}","${c.fullName}","${c.phone?.getValue() || ''}","${c.email?.getValue() || ''}","${c.status}",${c.loyaltyPoints},"${c.createdAt.toISOString()}"`,
      )
      .join('\n');

    const buffer = Buffer.from(header + rows, 'utf-8');

    return {
      buffer,
      filename: `customers_${Date.now()}.csv`,
      contentType: 'text/csv; charset=utf-8',
    };
  }
}
