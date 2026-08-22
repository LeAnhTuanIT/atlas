import { UpdateCustomerDto } from '../../dtos/update-customer.dto';

export class UpdateCustomerCommand {
  constructor(
    public readonly merchantId: string,
    public readonly id: string,
    public readonly dto: UpdateCustomerDto,
  ) {}
}
