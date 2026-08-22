import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { BaseEntity } from '../../domain/base.entity';
import { MapperPort } from '../../application/ports/mapper.port';
import { BaseOrmEntity } from './base.orm-entity';
import {
  paginateByUuidCursor,
  type CursorPaginationParams,
} from './cursor-pagination.util';

export type UuidCursorPaginationParams = CursorPaginationParams;

export interface UuidCursorPaginatedResult<T> {
  items: T[];
  meta: {
    limit: number;
    hasNextPage: boolean;
    nextCursorUuid: string | null;
  };
}

export abstract class TypeOrmBaseRepository<
  TDomainEntity extends BaseEntity<string>,
  TOrmEntity extends BaseOrmEntity & ObjectLiteral,
> {
  constructor(
    protected readonly typeOrmRepository: Repository<TOrmEntity>,
    protected readonly mapper: MapperPort<TDomainEntity, TOrmEntity>,
    protected readonly alias: string = 'entity',
  ) {}

  /**
   * Phân trang trực tiếp từ UUID của bản ghi cuối cùng
   */
  async findByUuidCursor(
    params: UuidCursorPaginationParams,
    customQuery?: (qb: SelectQueryBuilder<TOrmEntity>) => void,
  ): Promise<UuidCursorPaginatedResult<TDomainEntity>> {
    const qb = this.typeOrmRepository.createQueryBuilder(this.alias);

    if (customQuery) {
      customQuery(qb);
    }

    const { items, meta } = await paginateByUuidCursor(qb, this.alias, params);

    return {
      items: items.map((e) => this.mapper.toDomain(e)),
      meta: {
        limit: meta.limit,
        hasNextPage: meta.hasNextPage,
        nextCursorUuid: meta.nextCursor,
      },
    };
  }
}
