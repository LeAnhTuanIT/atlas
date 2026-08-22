import { CommandHandler, EventPublisher, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, BadRequestException, Inject } from '@nestjs/common';
import { CreateCustomerCommand } from './create-customer.command';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../../domain/repositories/customer.repository.interface';
import { Customer } from '../../../domain/models/customer.model';
import { PhoneNumber } from '../../../domain/value-objects/phone.vo';
import { Email } from '../../../domain/value-objects/email.vo';

@CommandHandler(CreateCustomerCommand)
export class CreateCustomerHandler implements ICommandHandler<CreateCustomerCommand> {
  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: CreateCustomerCommand): Promise<{ id: string }> {
    const { merchantId, fullName, phone, email, password } = command;

    if (!phone && !email) {
      throw new BadRequestException(
        'Phải cung cấp ít nhất số điện thoại hoặc email',
      );
    }

    const phoneVo = phone ? new PhoneNumber(phone) : undefined;
    const emailVo = email ? new Email(email) : undefined;

    if (phoneVo) {
      const existingPhone = await this.customerRepository.findByPhone(
        merchantId,
        phoneVo,
      );
      if (existingPhone) {
        throw new ConflictException(
          'Khách hàng với số điện thoại này đã tồn tại',
        );
      }
    }

    if (emailVo) {
      const existingEmail = await this.customerRepository.findByEmail(
        merchantId,
        emailVo,
      );
      if (existingEmail) {
        throw new ConflictException('Khách hàng với email này đã tồn tại');
      }
    }

    const customer = this.publisher.mergeObjectContext(
      Customer.create({
        merchantId,
        fullName,
        phone: phoneVo,
        email: emailVo,
        passwordHash: password,
      }),
    );

    await this.customerRepository.save(customer);
    customer.commit();

    return { id: customer.id.getValue() };
  }
}
