import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerchantOrmEntity } from '@/modules/merchant//infrastructure/persistence/entities/merchant.orm-entity';
import { MERCHANT_REPOSITORY } from '@/modules/merchant//domain/repositories/merchant.repository.interface';
import { TypeOrmMerchantRepository } from '@/modules/merchant//infrastructure/persistence/repositories/typeorm-merchant.repository';
import { SystemMerchantController } from '@/modules/merchant//presentation/http/merchant.controller';
import { AuthModule } from '../auth/auth.module';
import { CreateMerchantUseCase } from '@/modules/merchant/application/commands/create-merchant/create-merchant.handler';
import { GetMerchantsUseCase } from '@/modules/merchant//application/queries/get-merchants/get-merchants.handler';

@Module({
  imports: [TypeOrmModule.forFeature([MerchantOrmEntity]), AuthModule],
  controllers: [SystemMerchantController],
  providers: [
    {
      provide: MERCHANT_REPOSITORY,
      useClass: TypeOrmMerchantRepository,
    },
    CreateMerchantUseCase,
    GetMerchantsUseCase,
  ],
  exports: [MERCHANT_REPOSITORY],
})
export class MerchantModule {}
