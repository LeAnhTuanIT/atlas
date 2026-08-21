import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { BaseEntity } from '../../domain/base.entity';
import { MapperPort } from '../../application/ports/mapper.port';
import { BaseOrmEntity } from './base.orm-entity';

export interface UuidCursorPaginationParams {
  cursorUuid?: string; // UUID của item cuối cùng từ trang trước
  limit?: number;
  order?: 'ASC' | 'DESC';
}

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
    const limit = params.limit || 20;
    const order = params.order || 'DESC';
    const cursorUuid = params.cursorUuid;

    const qb = this.typeOrmRepository.createQueryBuilder(this.alias);

    // Áp dụng filters bổ sung nếu có
    if (customQuery) {
      customQuery(qb);
    }

    // Nếu client truyền UUID của record cuối cùng từ trang trước
    if (cursorUuid) {
      const operator = order === 'DESC' ? '<' : '>';
      
      // Subquery tối ưu: Lấy id tự tăng từ UUID để làm mốc lọc
      qb.andWhere(
        `${this.alias}.id ${operator} (
          SELECT sub.id FROM ${this.typeOrmRepository.metadata.tableName} sub 
          WHERE sub.uuid = :cursorUuid
        )`,
        { cursorUuid },
      );
    }

    // Query limit + 1 để kiểm tra trang kế tiếp
    qb.orderBy(`${this.alias}.id`, order).take(limit + 1);

    const ormEntities = await qb.getMany();
    const hasNextPage = ormEntities.length > limit;
    const nodes = hasNextPage ? ormEntities.slice(0, limit) : ormEntities;

    // UUID của phần tử cuối cùng sẽ trở thành nextCursorUuid
    const nextCursorUuid = hasNextPage && nodes.length > 0 
      ? nodes[nodes.length - 1].uuid 
      : null;

    const domainEntities = nodes.map((e) => this.mapper.toDomain(e));

    return {
      items: domainEntities,
      meta: {
        limit,
        hasNextPage,
        nextCursorUuid,
      },
    };
  }
}