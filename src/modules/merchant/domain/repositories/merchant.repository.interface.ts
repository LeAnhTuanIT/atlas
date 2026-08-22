import { MerchantAggregate } from '../models/merchant.aggregate';

export const MERCHANT_REPOSITORY = Symbol('MERCHANT_REPOSITORY');

export interface IMerchantRepository {
  save(merchant: MerchantAggregate): Promise<MerchantAggregate>;
  findByUuid(uuid: string): Promise<MerchantAggregate | null>;
  findByCode(code: string): Promise<MerchantAggregate | null>;
  findAll(params: {
    search?: string;
    cursor?: string;
    limit: number;
  }): Promise<{
    items: MerchantAggregate[];
    hasNextPage: boolean;
    nextCursor: string | null;
  }>;
  delete(uuid: string): Promise<void>;
}
