/**
 * Pagination parameters from request
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
}

/**
 * Pagination metadata in response
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Database pagination options
 */
export interface DatabasePaginationOptions {
  offset: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
