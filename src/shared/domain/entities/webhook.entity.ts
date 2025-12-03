/**
 * Webhook entity representing a webhook subscription for event notifications.
 * Requirements: 16.1, 16.2, 16.5, 16.6
 */
export class Webhook {
  id: string;
  userId: string;
  url: string;
  events: string[];
  secret: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(props: {
    id: string;
    userId: string;
    url: string;
    events: string[];
    secret: string;
    isActive?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    this.id = props.id;
    this.userId = props.userId;
    this.url = props.url;
    this.events = props.events;
    this.secret = props.secret;
    this.isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  /**
   * Checks if the webhook is subscribed to a specific event
   * Requirement: 16.2
   */
  isSubscribedTo(eventType: string): boolean {
    return this.events.includes(eventType);
  }

  /**
   * Adds an event subscription
   */
  subscribeToEvent(eventType: string): void {
    if (!this.events.includes(eventType)) {
      this.events.push(eventType);
      this.updatedAt = new Date();
    }
  }

  /**
   * Removes an event subscription
   */
  unsubscribeFromEvent(eventType: string): void {
    const initialLength = this.events.length;
    this.events = this.events.filter((e) => e !== eventType);

    if (this.events.length !== initialLength) {
      this.updatedAt = new Date();
    }
  }

  /**
   * Activates the webhook
   */
  activate(): void {
    this.isActive = true;
    this.updatedAt = new Date();
  }

  /**
   * Deactivates the webhook
   * Requirement: 16.6
   */
  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  /**
   * Updates the webhook URL
   */
  updateUrl(url: string): void {
    this.url = url;
    this.updatedAt = new Date();
  }

  /**
   * Updates the webhook secret
   */
  updateSecret(secret: string): void {
    this.secret = secret;
    this.updatedAt = new Date();
  }

  /**
   * Gets all subscribed events
   */
  getEvents(): string[] {
    return [...this.events];
  }
}
