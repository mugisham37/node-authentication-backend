import { ValidationError } from '../../errors/types/application-error.js';

/**
 * PhoneNumber value object representing a validated E.164 format phone number.
 * E.164 format: +[country code][subscriber number]
 * Example: +14155552671
 * Requirements: 4.2
 */
export class PhoneNumber {
  private readonly value: string;

  constructor(phoneNumber: string) {
    const normalized = this.normalize(phoneNumber);
    if (!this.isValidE164(normalized)) {
      throw new ValidationError(
        'Invalid phone number format. Must be in E.164 format (+[country code][number])'
      );
    }
    this.value = normalized;
  }

  /**
   * Normalizes phone number by removing spaces, dashes, and parentheses
   */
  private normalize(phoneNumber: string): string {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return '';
    }
    return phoneNumber.replace(/[\s\-()]/g, '');
  }

  /**
   * Validates E.164 format:
   * - Starts with +
   * - Followed by 1-3 digit country code
   * - Followed by up to 15 digits total (including country code)
   * - Total length: 8-16 characters (including +)
   */
  private isValidE164(phoneNumber: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phoneNumber);
  }

  toString(): string {
    return this.value;
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }

  /**
   * Returns the country code (e.g., +1 for US/Canada)
   */
  getCountryCode(): string {
    // Extract country code (1-3 digits after +)
    const match = this.value.match(/^\+(\d{1,3})/);
    return match ? `+${match[1]}` : '';
  }
}
