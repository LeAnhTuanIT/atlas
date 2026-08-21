export class CursorPaginatedResponseDto<T> {
  readonly items: T[];
  readonly meta: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };

  constructor(items: T[], limit: number, nextCursor: string | null = null) {
    this.items = items;
    this.meta = {
      limit,
      hasNextPage: Boolean(nextCursor),
      nextCursor,
    };
  }
}