export interface PaginatedQueryParams {
  page?: number;
  limit?: number;
  order?: 'ASC' | 'DESC';
  orderBy?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export abstract class RepositoryPort<TEntity, TId = string> {
  abstract save(entity: TEntity): Promise<void>;
  abstract findById(id: TId): Promise<TEntity | null>;
  abstract findAll(params?: PaginatedQueryParams): Promise<PaginatedResult<TEntity>>;
  abstract deleteById(id: TId): Promise<boolean>;
}