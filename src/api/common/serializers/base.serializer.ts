/**
 * Base serializer utilities
 */
export class BaseSerializer {
  /**
   * Format date to ISO 8601 string
   */
  protected static formatDate(date: Date | null | undefined): string | null {
    if (!date) return null;
    return date.toISOString();
  }

  /**
   * Exclude sensitive fields from object
   */
  protected static excludeFields<T extends Record<string, unknown>>(
    obj: T,
    fieldsToExclude: (keyof T)[]
  ): Partial<T> {
    const result = { ...obj };
    for (const field of fieldsToExclude) {
      delete result[field];
    }
    return result;
  }

  /**
   * Pick specific fields from object
   */
  protected static pickFields<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    fieldsToPick: K[]
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const field of fieldsToPick) {
      result[field] = obj[field];
    }
    return result;
  }

  /**
   * Transform value object to primitive
   */
  protected static extractValue<T>(valueObject: { toString(): string } | T): string | T {
    if (valueObject && typeof valueObject === 'object' && 'toString' in valueObject) {
      return valueObject.toString();
    }
    return valueObject;
  }
}
