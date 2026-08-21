import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { UpdateCustomerCommand } from './update-customer.command';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../../domain/repositories/customer.repository.interface';
import { CustomerId } from '../../../domain/value-objects/customer-id.vo';
import { PhoneNumber } from '../../../domain/value-objects/phone.vo';
import { Email } from '../../../domain/value-objects/email.vo';

@CommandHandler(UpdateCustomerCommand)
export class UpdateCustomerHandler implements ICommandHandler<UpdateCustomerCommand> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: UpdateCustomerCommand): Promise<void> {
    const { merchantId, id, dto } = command;
    const customerId = new CustomerId(id);

    const customer = await this.customerRepository.findById(
      merchantId,
      customerId,
    );
    if (!customer) {
      throw new NotFoundException('Không tìm thấy khách hàng');
    }

    const boundCustomer = this.publisher.mergeObjectContext(customer);

    const phoneVo = dto.phone ? new PhoneNumber(dto.phone) : undefined;
    const emailVo = dto.email ? new Email(dto.email) : undefined;

    if (dto.fullName || phoneVo || emailVo) {
      boundCustomer.updateProfile(
        dto.fullName || customer.fullName,
        phoneVo,
        emailVo,
      );
    }

    if (dto.status === 'BLOCKED') {
      boundCustomer.block();
    } else if (dto.status === 'ACTIVE') {
      boundCustomer.activate();
    }

    await this.customerRepository.save(boundCustomer);
    boundCustomer.commit();
  }
}
