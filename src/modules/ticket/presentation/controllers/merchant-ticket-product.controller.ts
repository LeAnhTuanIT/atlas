import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { MerchantAuthGuard } from '@/shared/infrastructure/auth/guards/auth-guards.guards';
import { CreateTicketProductHandler } from '../../application/commands/create-ticket-product/create-ticket-product.handler';
import { CreateTicketProductCommand } from '../../application/commands/create-ticket-product/create-ticket-product.command';
import { PublishTicketProductHandler } from '../../application/commands/publish-ticket-product/publish-ticket-product.handler';
import { PublishTicketProductCommand } from '../../application/commands/publish-ticket-product/publish-ticket-product.command';
import { CreateTicketProductDto } from '../../application/dtos/create-ticket-product.dto';

interface AuthenticatedRequest extends Request {
  user: { merchantId: string };
}

@Controller({ path: 'merchant/tickets/products', version: '1' })
@UseGuards(MerchantAuthGuard)
export class MerchantTicketProductController {
  constructor(
    private readonly createHandler: CreateTicketProductHandler,
    private readonly publishHandler: PublishTicketProductHandler,
  ) {}

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTicketProductDto) {
    const product = await this.createHandler.execute(
      new CreateTicketProductCommand(
        req.user.merchantId,
        dto.name,
        dto.description,
        dto.priceAmount,
        dto.priceCurrency ?? 'VND',
        dto.validityType,
        dto.usageRule,
        dto.zones,
        dto.sessions.map((s) => ({ startAt: new Date(s.startAt), endAt: new Date(s.endAt) })),
      ),
    );

    return {
      id: product.id,
      name: product.getName(),
      status: product.getStatus(),
      zones: product.getZones().map((z) => ({ id: z.getId(), name: z.getName(), quota: z.getQuota() })),
      sessions: product
        .getSessions()
        .map((s) => ({ id: s.getId(), startAt: s.getStartAt(), endAt: s.getEndAt() })),
    };
  }

  @Post(':id/publish')
  async publish(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const product = await this.publishHandler.execute(
      new PublishTicketProductCommand(req.user.merchantId, id),
    );
    return { id: product.id, status: product.getStatus() };
  }
}
