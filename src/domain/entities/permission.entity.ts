/**
 * Permission entity representing authorization to perform actions on resources.
 * Requirements: 11.1, 12.1, 12.3, 12.4
 */
export class Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
  createdAt: Date;

  constructor(props: {
    id: string;
    resource: string;
    action: string;
    description: string;
    createdAt?: Date;
  }) {
    this.id = props.id;
    this.resource = props.resource;
    this.action = props.action;
    this.description = props.description;
    this.createdAt = props.createdAt ?? new Date();
  }

  /**
   * Checks if this permission matches a resource and action
   * Supports wildcard matching for resources
   * Requirement: 12.3, 12.4
   *
   * Examples:
   * - Permission("users", "read") matches ("users", "read")
   * - Permission("*", "read") matches ("users", "read")
   * - Permission("users", "*") matches ("users", "read")
   * - Permission("*", "*") matches any resource and action
   */
  matches(resource: string, action: string): boolean {
    const resourceMatches = this.resource === '*' || this.resource === resource;
    const actionMatches = this.action === '*' || this.action === action;
    return resourceMatches && actionMatches;
  }

  /**
   * Returns a string representation of the permission
   */
  toString(): string {
    return `${this.resource}:${this.action}`;
  }

  /**
   * Checks if this permission equals another permission
   */
  equals(other: Permission): boolean {
    return this.resource === other.resource && this.action === other.action;
  }
}
