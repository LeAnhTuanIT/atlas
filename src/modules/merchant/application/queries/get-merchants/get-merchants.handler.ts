// src/modules/merchant/application/queries/handlers/get-merchants.handler.ts
import { Injectable, Inject } from '@nestjs/common';
import { MERCHANT_REPOSITORY } from '@/modules/merchant/domain/repositories/merchant.repository.interface';
import type { IMerchantRepository } from '@/modules/merchant/domain/repositories/merchant.repository.interface';

@Injectable()
export class GetMerchantsUseCase {
  constructor(
    @Inject(MERCHANT_REPOSITORY)
    private readonly merchantRepo: IMerchantRepository,
  ) {}

  async execute(params: { search?: string; page?: number; limit?: number }) {
    const { items, total } = await this.merchantRepo.findAll({
      search: params.search,
      page: params.page || 1,
      limit: params.limit || 10,
    });

    return {
      items: items.map((m: any) => {
        const ownerUser =
          m.merchantUsers?.find((u: any) => u.role === 'OWNER') ||
          m.merchantUsers?.[0];

        // Hỗ trợ cả trường hợp m.code là Value Object (có .getValue()) hoặc string thuần từ TypeORM
        const code =
          typeof m.code?.getValue === 'function' ? m.code.getValue() : m.code;

        return {
          id: m.uuid,
          code,
          name: m.name,
          status: m.status,
          email: ownerUser?.email || m.settings?.email || '',
          phone: m.settings?.phone || ownerUser?.phone || '',
          address: m.settings?.address || '',
          settings: m.settings,
          createdAt: m.createdAt,
        };
      }),
      total,
      page: params.page || 1,
      limit: params.limit || 10,
    };
  }
}
