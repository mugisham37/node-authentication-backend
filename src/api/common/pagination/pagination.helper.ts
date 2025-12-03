import {
  PaginationParams,
  PaginationMeta,
  PaginatedResponse,
  DatabasePaginationOptions,
} from './pagination.types.js';

/**
 * Default pagination values
 */
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;
const MIN_PAGE = 1;

/**
 * Pagination helper utility class
 */
export class PaginationHelper {
  /**
   * Validate and normalize pagination parameters
   */
  static validateParams(params: PaginationParams): Required<
    Pick<PaginationParams, 'page' | 'limit'>
  > & {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } {
    let page = params.page ?? DEFAULT_PAGE;
    let limit = params.limit ?? DEFAULT_LIMIT;

    // Validate page
    if (page < MIN_PAGE) {
      page = MIN_PAGE;
    }

    // Validate limit
    if (limit < MIN_LIMIT) {
      limit = MIN_LIMIT;
    }
    if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }

    return {
      page,
      limit,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder ?? 'desc',
    };
  }

  /**
   * Calculate offset for database query
   */
  static calculateOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Build pagination metadata
   */
  static buildMeta(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrevious,
    };
  }

  /**
   * Build paginated response
   */
  static buildResponse<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): PaginatedResponse<T> {
    return {
      data,
      pagination: this.buildMeta(page, limit, total),
    };
  }

  /**
   * Get database pagination options
   */
  static getDatabaseOptions(params: PaginationParams): DatabasePaginationOptions {
    const validated = this.validateParams(params);
    const offset = this.calculateOffset(validated.page, validated.limit);

    return {
      offset,
      limit: validated.limit,
      sortBy: validated.sortBy,
      sortOrder: validated.sortOrder,
    };
  }

  /**
   * Encode cursor for cursor-based pagination
   */
  static encodeCursor(value: string | number | Date): string {
    const stringValue = typeof value === 'object' ? value.toISOString() : String(value);
    return Buffer.from(stringValue).toString('base64');
  }

  /**
   * Decode cursor for cursor-based pagination
   */
  static decodeCursor(cursor: string): string {
    try {
      return Buffer.from(cursor, 'base64').toString('utf-8');
    } catch {
      throw new Error('Invalid cursor format');
    }
  }

  /**
   * Build cursor-based pagination metadata
   */
  static buildCursorMeta<T extends { id: string }>(
    data: T[],
    limit: number,
    total: number
  ): PaginationMeta & { nextCursor?: string; previousCursor?: string } {
    const hasNext = data.length === limit;
    const nextCursor =
      hasNext && data.length > 0 ? this.encodeCursor(data[data.length - 1].id) : undefined;
    const previousCursor = data.length > 0 ? this.encodeCursor(data[0].id) : undefined;

    return {
      page: 1, // Not applicable for cursor pagination
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext,
      hasPrevious: false, // Cursor pagination typically doesn't support backward navigation
      nextCursor,
      previousCursor,
    };
  }
}
