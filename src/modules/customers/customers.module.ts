import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';

import { CustomerOrmEntity } from '@/modules/customers/infrastructure/persistence/entities/customer.orm-entity';
import { CustomerAddressOrmEntity } from '@/modules/customers/infrastructure/persistence/entities/customer-address.orm-entity';
import { CustomerTypeOrmRepository } from '@/modules/customers/infrastructure/persistence/repositories/customer.typeorm-repository';
import { CUSTOMER_REPOSITORY } from '@/modules/customers/domain/repositories/customer.repository.interface';

// Commands
import { CreateCustomerHandler } from '@/modules/customers/application/commands/create-customer/create-customer.handler';
import { UpdateCustomerHandler } from '@/modules/customers/application/commands/update-customer/update-customer.handler';
import { DeleteCustomerHandler } from '@/modules/customers/application/commands/delete-customer/delete-customer.handler';
import { ImportCustomersHandler } from '@/modules/customers/application/commands/import-customers/import-customers.handler';

// Queries
import { ListCustomersHandler } from '@/modules/customers/application/queries/list-customers/list-customers.handler';
import { ExportCustomersHandler } from '@/modules/customers/application/queries/export-customers/export-customers.handler';

// Presentation
import { CustomerController } from '@/modules/customers/presentation/http/customer.controller';
import { CustomerImportConsumer } from '@/modules/customers/presentation/message-queue/customer-sync.consumer';
import { GetCustomerByIdHandler } from '@/modules/customers/application/queries/get-customer-by-id/get-customer-by-id.handler';

const CommandHandlers = [
  CreateCustomerHandler,
  UpdateCustomerHandler,
  DeleteCustomerHandler,
  ImportCustomersHandler,
];

const QueryHandlers = [
  ListCustomersHandler,
  ExportCustomersHandler,
  GetCustomerByIdHandler,
];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([CustomerOrmEntity, CustomerAddressOrmEntity]),
    BullModule.registerQueue({
      name: 'customer-import',
    }),
  ],
  controllers: [CustomerController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    CustomerImportConsumer,
    {
      provide: CUSTOMER_REPOSITORY,
      useClass: CustomerTypeOrmRepository,
    },
  ],
  exports: [CUSTOMER_REPOSITORY],
})
export class CustomersModule {}
