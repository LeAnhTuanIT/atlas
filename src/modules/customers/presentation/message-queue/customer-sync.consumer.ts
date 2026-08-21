import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  CUSTOMER_REPOSITORY,
  type ICustomerRepository,
} from '../../domain/repositories/customer.repository.interface';
import { Customer } from '../../domain/models/customer.model';
import { PhoneNumber } from '../../domain/value-objects/phone.vo';
import { Email } from '../../domain/value-objects/email.vo';

@Processor('customer-import')
export class CustomerImportConsumer extends WorkerHost {
  private readonly logger = new Logger(CustomerImportConsumer.name);

  constructor(
    @Inject(CUSTOMER_REPOSITORY)
    private readonly customerRepository: ICustomerRepository,
  ) {
    super();
  }

  async process(job: Job<{ merchantId: string; fileBase64: string; fileName: string }>): Promise<void> {
    this.logger.log(`Processing import for merchant: ${job.data.merchantId}`);
    
    const buffer = Buffer.from(job.data.fileBase64, 'base64');
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    const customersToInsert: Customer[] = [];

    // Bỏ qua dòng header
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.replace(/"/g, '').trim());
      const [fullName, phone, email] = cols;

      if (!fullName) continue;

      try {
        const customer = Customer.create({
          merchantId: job.data.merchantId,
          fullName,
          phone: phone ? new PhoneNumber(phone) : undefined,
          email: email ? new Email(email) : undefined,
        });
        customersToInsert.push(customer);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Skip invalid row ${i}: ${errorMessage}`);
      }
    }

    if (customersToInsert.length > 0) {
      await this.customerRepository.saveMany(customersToInsert);
      this.logger.log(`Imported ${customersToInsert.length} customers successfully.`);
    }
  }
}