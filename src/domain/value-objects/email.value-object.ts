import { ValidationError } from '../../shared/errors/types/application-error.js';

/**
 * Email value object representing a validated email address.
 * Ensures RFC 5322 compliant email format and normalizes to lowercase.
 */
export class Email {
  private readonly value: string;

  constructor(email: string) {
    if (!this.isValid(email)) {
      throw new ValidationError('Invalid email format');
    }
    this.value = email.toLowerCase().trim();
  }

  /**
   * Validates email format using RFC 5322 compliant regex
   */
  private isValid(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // RFC 5322 compliant email regex
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    return emailRegex.test(email) && email.length <= 255;
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }
}
