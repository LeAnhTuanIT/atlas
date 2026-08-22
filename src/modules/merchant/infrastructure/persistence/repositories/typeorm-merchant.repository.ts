// src/modules/merchant/infrastructure/persistence/repositories/typeorm-merchant.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IMerchantRepository } from '@/modules/merchant/domain/repositories/merchant.repository.interface';
import { MerchantAggregate } from '@/modules/merchant/domain/models/merchant.aggregate';
import { MerchantOrmEntity } from '../entities/merchant.orm-entity';
import { MerchantMapper } from '../mappers/merchant.mapper';
import { paginateByUuidCursor } from '@/shared/infrastructure/persistence/cursor-pagination.util';

@Injectable()
export class TypeOrmMerchantRepository implements IMerchantRepository {
  constructor(
    @InjectRepository(MerchantOrmEntity)
    private readonly repo: Repository<MerchantOrmEntity>,
  ) {}

  async save(merchant: MerchantAggregate): Promise<MerchantAggregate> {
    const raw = MerchantMapper.toOrm(merchant);
    const saved = await this.repo.save(raw);
    return MerchantMapper.toDomain(saved);
  }

  async findByUuid(uuid: string): Promise<MerchantAggregate | null> {
    const found = await this.repo.findOne({
      where: { uuid },
      relations: {
        merchantUsers: true, // Sửa thành dạng Object cho TypeORM 0.3+
      },
    });
    return found ? MerchantMapper.toDomain(found) : null;
  }

  async findByCode(code: string): Promise<MerchantAggregate | null> {
    const found = await this.repo.findOne({
      where: { code },
      relations: {
        merchantUsers: true, // Sửa thành dạng Object cho TypeORM 0.3+
      },
    });
    return found ? MerchantMapper.toDomain(found) : null;
  }

  async findAll(params: {
    search?: string;
    cursor?: string;
    limit: number;
  }): Promise<{
    items: any[];
    hasNextPage: boolean;
    nextCursor: string | null;
  }> {
    const { search = '', cursor, limit = 10 } = params;
    const qb = this.repo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.merchantUsers', 'mu')
      .where('m.deletedAt IS NULL');

    if (search) {
      qb.andWhere(
        '(m.name ILIKE :search OR m.code ILIKE :search OR mu.email ILIKE :search)',
        {
          search: `%${search}%`,
        },
      );
    }

    const { items, meta } = await paginateByUuidCursor(qb, 'm', {
      cursor,
      limit,
      order: 'DESC',
    });

    return {
      items,
      hasNextPage: meta.hasNextPage,
      nextCursor: meta.nextCursor,
    };
  }

  async delete(uuid: string): Promise<void> {
    await this.repo.softDelete({ uuid });
  }
}
