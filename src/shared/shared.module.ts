import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { GlobalExceptionFilter } from './infrastructure/filters/global-exception.filter';
import { ResponseTransformInterceptor } from './infrastructure/interceptors/response-transform.interceptor';
import { MerchantContextInterceptor } from './infrastructure/interceptors/merchant-context.interceptor';

@Global()
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MerchantContextInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },
  ],
  exports: [],
})
export class SharedModule {}