import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { DeleteCustomerCommand } from '../update-customer/delete-customer/delete-customer.command';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../../domain/repositories/customer.repository.interface';
import { CustomerId } from '../../../domain/value-objects/customer-id.vo';

@CommandHandler(DeleteCustomerCommand)
export class DeleteCustomerHandler implements ICommandHandler<DeleteCustomerCommand> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {}

  async execute(command: DeleteCustomerCommand): Promise<void> {
    const customerId = new CustomerId(command.id);
    const existing = await this.customerRepository.findById(
      command.merchantId,
      customerId,
    );
    if (!existing) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    await this.customerRepository.delete(command.merchantId, customerId);
  }
}
