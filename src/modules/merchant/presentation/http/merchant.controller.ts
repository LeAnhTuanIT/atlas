import { Controller, Get, Post, Body, Query, UseGuards, HttpCode, HttpStatus, Param, Patch, Delete } from '@nestjs/common';
import { SystemAuthGuard } from '@/shared/infrastructure/auth/guards/auth-guards.guards';
import { CreateMerchantDto } from '@/modules/merchant/application/dtos/create-merchant.dto';
import { CreateMerchantUseCase } from '@/modules/merchant/application/commands/create-merchant/create-merchant.handler';
import { GetMerchantsUseCase } from '@/modules/merchant/application/queries/get-merchants/get-merchants.handler';

@Controller({
  path: 'system/merchants',
  version: '1',
})
@UseGuards(SystemAuthGuard)
export class SystemMerchantController {
  constructor(
    private readonly createMerchantUseCase: CreateMerchantUseCase,
    private readonly getMerchantsUseCase: GetMerchantsUseCase,
  ) {}

  @Get()
  async getMerchants(
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    return this.getMerchantsUseCase.execute({ search, page: +page, limit: +limit });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createMerchant(@Body() dto: CreateMerchantDto) {
    return this.createMerchantUseCase.execute(dto);
  }
}