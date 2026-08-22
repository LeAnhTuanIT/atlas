import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';

export interface CursorPaginationParams {
  /** uuid của bản ghi cuối cùng ở trang trước — không truyền = lấy trang đầu */
  cursor?: string;
  limit?: number;
  order?: 'ASC' | 'DESC';
}

export interface CursorPaginatedResult<T> {
  items: T[];
  meta: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
}

/**
 * Phân trang kiểu keyset: FE gửi lên `uuid` của bản ghi cuối trang trước,
 * BE seek theo cột `id` bigint (auto-increment, có index tự nhiên) thay vì OFFSET.
 * `id` không bao giờ lộ ra ngoài — chỉ dùng nội bộ làm điểm seek.
 */
export async function paginateByUuidCursor<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  params: CursorPaginationParams,
): Promise<CursorPaginatedResult<T>> {
  const limit = params.limit || 20;
  const order = params.order || 'DESC';

  if (params.cursor) {
    const operator = order === 'DESC' ? '<' : '>';
    const tableName = qb.expressionMap.mainAlias?.tablePath;

    qb.andWhere(
      `${alias}.id ${operator} (SELECT sub.id FROM ${tableName} sub WHERE sub.uuid = :cursor)`,
      { cursor: params.cursor },
    );
  }

  qb.orderBy(`${alias}.id`, order).take(limit + 1);

  const records = await qb.getMany();
  const hasNextPage = records.length > limit;
  const items = hasNextPage ? records.slice(0, limit) : records;
  const nextCursor =
    hasNextPage && items.length > 0
      ? ((items[items.length - 1] as unknown as { uuid: string }).uuid ?? null)
      : null;

  return {
    items,
    meta: { limit, hasNextPage, nextCursor },
  };
}
