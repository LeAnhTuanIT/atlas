export class PaginatedResponseDto<T> {
  readonly items: T[];
  readonly meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };

  constructor(items: T[], total: number, page: number, limit: number) {
    const totalPages = Math.ceil(total / limit) || 1;

    this.items = items;
    this.meta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
