import { GetCustomersDto } from '../../dtos/get-customers.dto';

export class ListCustomersQuery {
  constructor(
    public readonly merchantId: string,
    public readonly params: GetCustomersDto,
  ) {}
}