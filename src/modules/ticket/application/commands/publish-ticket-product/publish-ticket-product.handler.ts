import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITicketProductRepository } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TICKET_PRODUCT_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import { PublishTicketProductCommand } from './publish-ticket-product.command';

@Injectable()
export class PublishTicketProductHandler {
  constructor(
    @Inject(TICKET_PRODUCT_REPOSITORY)
    private readonly productRepo: ITicketProductRepository,
  ) {}

  async execute(cmd: PublishTicketProductCommand): Promise<TicketProduct> {
    const product = await this.productRepo.findById(cmd.ticketProductId);
    if (!product || product.getMerchantId() !== cmd.merchantId) {
      throw new NotFoundException('Không tìm thấy loại vé');
    }

    product.publish();
    await this.productRepo.save(product);
    return product;
  }
}
