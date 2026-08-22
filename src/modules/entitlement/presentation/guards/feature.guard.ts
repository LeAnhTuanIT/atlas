// presentation/guards/feature.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';
import { CheckFeatureAccessHandler } from '../../application/queries/check-feature-access.handler';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly checkAccessHandler: CheckFeatureAccessHandler,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) return true;

    const request = context.switchToHttp().getRequest();
    const merchantId =
      request.user?.merchantId || request.headers['x-merchant-id'];

    if (!merchantId) {
      throw new ForbiddenException('Merchant identity context is missing.');
    }

    const hasAccess = await this.checkAccessHandler.execute(
      merchantId,
      requiredFeature,
    );
    if (!hasAccess) {
      throw new ForbiddenException({
        errorCode: 'FEATURE_ENTITLEMENT_REQUIRED',
        message: `Tính năng [${requiredFeature}] chưa được cấp quyền hoặc đã hết hạn.`,
      });
    }

    return true;
  }
}
