import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class SystemAuthGuard extends AuthGuard('jwt-system') {}

@Injectable()
export class MerchantAuthGuard extends AuthGuard('jwt-merchant') {}

@Injectable()
export class CustomerAuthGuard extends AuthGuard('jwt-customer') {}
