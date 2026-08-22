import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { MerchantContext } from '../context/merchant-context';

@Injectable()
export class MerchantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (user && user.merchantId) {
      return new Observable((subscriber) => {
        MerchantContext.run(
          {
            userId: user.sub,
            merchantId: user.merchantId,
            role: user.role,
            permissions: user.permissions || [],
            isSuperAdmin: user.scope === 'SYSTEM',
          },
          () => {
            next.handle().subscribe(subscriber);
          },
        );
      });
    }

    return next.handle();
  }
}
