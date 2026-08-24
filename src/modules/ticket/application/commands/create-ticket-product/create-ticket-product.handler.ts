import { Inject, Injectable } from '@nestjs/common';
import type { ITicketProductRepository } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TICKET_PRODUCT_REPOSITORY } from '@/modules/ticket/domain/repositories/ticket-product.repository.interface';
import { TicketProduct } from '@/modules/ticket/domain/models/ticket-product.aggregate';
import { CreateTicketProductCommand } from './create-ticket-product.command';

@Injectable()
export class CreateTicketProductHandler {
  constructor(
    @Inject(TICKET_PRODUCT_REPOSITORY)
    private readonly productRepo: ITicketProductRepository,
  ) {}

  async execute(cmd: CreateTicketProductCommand): Promise<TicketProduct> {
    const product = TicketProduct.create({
      merchantId: cmd.merchantId,
      name: cmd.name,
      description: cmd.description,
      priceAmount: cmd.priceAmount,
      priceCurrency: cmd.priceCurrency,
      validityType: cmd.validityType,
      usageRule: cmd.usageRule,
      zones: cmd.zones,
      sessions: cmd.sessions,
    });

    await this.productRepo.save(product);
    return product;
  }
}
