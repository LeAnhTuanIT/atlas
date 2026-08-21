import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SystemUserOrmEntity } from '@/modules/system-user/infrastructure/persistence/entities/system-user.orm-entity';
import { MerchantOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant.orm-entity';
import { MerchantUserOrmEntity } from '@/modules/merchant/infrastructure/persistence/entities/merchant-user.orm-entity';
import { CustomerOrmEntity } from '@/modules/customers/infrastructure/persistence/entities/customer.orm-entity';

import { PASSWORD_HASHER_PORT } from '@/modules/auth/application/ports/password-hasher.port';
import { TOKEN_GENERATOR_PORT } from '@/modules/auth/application/ports/token-generator.port';
import { BcryptPasswordHasherAdapter } from '@/modules/auth/infrastructure/adapters/bcrypt-password-hasher.adapter';
import { JwtTokenGeneratorAdapter } from '@/modules/auth/infrastructure/adapters/jwt-token-generator.adapter';

import { SystemJwtStrategy } from '@/shared/infrastructure/auth/strategies/system-jwt.strategy';
import { MerchantJwtStrategy } from '@/shared/infrastructure/auth/strategies/merchant-jwt.strategy';
import { CustomerJwtStrategy } from '@/shared/infrastructure/auth/strategies/customer-jwt.strategy';

import { UnifiedLoginHandler } from './application/commands/unified-login/unified-login.handler';
import { AuthController } from './presentation/http/auth.controller';
import { CustomersModule } from '../customers/customers.module';
import { RefreshTokenHandler } from './application/commands/refresh-token/refresh-token.handler';

@Module({
  imports: [
    CqrsModule,
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([
      SystemUserOrmEntity,
      MerchantOrmEntity,
      MerchantUserOrmEntity,
      CustomerOrmEntity,
    ]),
    CustomersModule
  ],
  controllers: [AuthController],
  providers: [
    SystemJwtStrategy,
    MerchantJwtStrategy,
    CustomerJwtStrategy,
    UnifiedLoginHandler,
    RefreshTokenHandler,
    {
      provide: PASSWORD_HASHER_PORT,
      useClass: BcryptPasswordHasherAdapter,
    },
    {
      provide: TOKEN_GENERATOR_PORT,
      useClass: JwtTokenGeneratorAdapter,
    },
  ],
  exports: [PASSWORD_HASHER_PORT, TOKEN_GENERATOR_PORT],
})
export class AuthModule {}