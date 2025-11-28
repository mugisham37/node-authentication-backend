import { ValidationError } from '../../core/errors/types/application-error.js';

/**
 * IPAddress value object representing a validated IPv4 or IPv6 address.
 * Requirements: 3.7, 7.1, 13.2
 */
export class IPAddress {
  private readonly value: string;
  private readonly version: 4 | 6;

  constructor(ipAddress: string) {
    const normalized = ipAddress?.trim();
    if (!normalized) {
      throw new ValidationError('IP address cannot be empty');
    }

    if (this.isValidIPv4(normalized)) {
      this.value = normalized;
      this.version = 4;
    } else if (this.isValidIPv6(normalized)) {
      this.value = this.normalizeIPv6(normalized);
      this.version = 6;
    } else {
      throw new ValidationError('Invalid IP address format');
    }
  }

  /**
   * Validates IPv4 address format
   * Format: xxx.xxx.xxx.xxx where xxx is 0-255
   */
  private isValidIPv4(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipv4Regex);

    if (!match) {
      return false;
    }

    // Check each octet is 0-255
    for (let i = 1; i <= 4; i++) {
      const octetStr = match[i];
      if (!octetStr) {
        return false;
      }
      const octet = parseInt(octetStr, 10);
      if (octet < 0 || octet > 255) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validates IPv6 address format
   * Supports full and compressed notation
   */
  private isValidIPv6(ip: string): boolean {
    // IPv6 regex supporting full and compressed notation
    const ipv6Regex =
      /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::)$/;

    return ipv6Regex.test(ip);
  }

  /**
   * Normalizes IPv6 address to lowercase
   */
  private normalizeIPv6(ip: string): string {
    return ip.toLowerCase();
  }

  toString(): string {
    return this.value;
  }

  equals(other: IPAddress): boolean {
    return this.value === other.value;
  }

  getValue(): string {
    return this.value;
  }

  getVersion(): 4 | 6 {
    return this.version;
  }

  isIPv4(): boolean {
    return this.version === 4;
  }

  isIPv6(): boolean {
    return this.version === 6;
  }
}
