import { MerchantAggregate } from '../models/merchant.aggregate';

export const MERCHANT_REPOSITORY = Symbol('MERCHANT_REPOSITORY');

export interface IMerchantRepository {
  save(merchant: MerchantAggregate): Promise<MerchantAggregate>;
  findByUuid(uuid: string): Promise<MerchantAggregate | null>;
  findByCode(code: string): Promise<MerchantAggregate | null>;
  findAll(params: { search?: string; page: number; limit: number }): Promise<{ items: MerchantAggregate[]; total: number }>;
  delete(uuid: string): Promise<void>;
}