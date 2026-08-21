import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ImportCustomersCommand } from './import-customers.command';

@CommandHandler(ImportCustomersCommand)
export class ImportCustomersHandler implements ICommandHandler<ImportCustomersCommand> {
  constructor(
    @InjectQueue('customer-import')
    private readonly importQueue: Queue,
  ) {}

  async execute(command: ImportCustomersCommand): Promise<{ jobId: string; message: string }> {
    const job = await this.importQueue.add('process-import', {
      merchantId: command.merchantId,
      fileBase64: command.fileBuffer.toString('base64'),
      fileName: command.fileName,
    });

    return {
      jobId: job.id as string,
      message: 'File import đã được đưa vào hàng đợi xử lý',
    };
  }
}