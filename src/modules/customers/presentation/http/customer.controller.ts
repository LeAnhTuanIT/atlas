import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClsService } from 'nestjs-cls';
import type { Response } from 'express';
import 'multer';
import { GetCustomerByIdQuery } from '../../application/queries/get-customer-by-id/get-customer-by-id.query';
import { CreateCustomerDto } from '../../application/dtos/create-customer.dto';

import { CreateCustomerCommand } from '../../application/commands/create-customer/create-customer.command';
import { UpdateCustomerCommand } from '../../application/commands/update-customer/update-customer.command';
import { ImportCustomersCommand } from '../../application/commands/import-customers/import-customers.command';


import { ListCustomersQuery } from '../../application/queries/list-customers/list-customers.query';
import { ExportCustomersQuery } from '../../application/queries/export-customers/export-customers.query';
import { GetCustomersDto } from '../../application/dtos/get-customers.dto';
import { DeleteCustomerCommand } from '../../application/commands/update-customer/delete-customer/delete-customer.command';
import { UpdateCustomerDto } from '../../application/dtos/update-customer.dto';

@Controller('customers')
export class CustomerController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly cls: ClsService,
  ) {}

  private getMerchantId(): string {
    return this.cls.get<string>('tenantId') || '1';
  }

  // 1. CREATE
  @Post()
  async create(@Body() dto: CreateCustomerDto) {
    const merchantId = this.getMerchantId();
    return this.commandBus.execute(
      new CreateCustomerCommand(
        merchantId,
        dto.fullName,
        dto.phone,
        dto.email,
        dto.password,
      ),
    );
  }

  // 2. READ (List & Pagination)
  @Get()
  async findAll(@Query() queryDto: GetCustomersDto) {
    const merchantId = this.getMerchantId();
    return this.queryBus.execute(
      new ListCustomersQuery(merchantId, queryDto),
    );
  }

  // 3. EXPORT (CSV / Excel)
  @Get('export')
  async export(@Res() res: Response, @Query('format') format: 'csv' | 'xlsx' = 'csv') {
    const merchantId = this.getMerchantId();
    const { buffer, filename, contentType } = await this.queryBus.execute(
      new ExportCustomersQuery(merchantId, format),
    );

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  // 4. READ (Detail)
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const merchantId = this.getMerchantId();
    return this.queryBus.execute(new GetCustomerByIdQuery(merchantId, id));
  }

  // 5. UPDATE
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    const merchantId = this.getMerchantId();
    return this.commandBus.execute(
      new UpdateCustomerCommand(merchantId, id, dto),
    );
  }

  // 6. DELETE (Soft Delete / Block)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    const merchantId = this.getMerchantId();
    await this.commandBus.execute(new DeleteCustomerCommand(merchantId, id));
  }

  // 7. IMPORT (Excel / CSV via Queue)
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(@UploadedFile() file: Express.Multer.File) {
    const merchantId = this.getMerchantId();
    return this.commandBus.execute(
      new ImportCustomersCommand(merchantId, file.buffer, file.originalname),
    );
  }
}