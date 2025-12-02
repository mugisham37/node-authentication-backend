export interface IWebhookService {
  createWebhook(
    userId: string,
    data: { url: string; events: string[]; description?: string }
  ): Promise<any>;
  getUserWebhooks(userId: string): Promise<any[]>;
  getWebhook(userId: string, webhookId: string): Promise<any>;
  updateWebhook(
    userId: string,
    webhookId: string,
    data: { url?: string; events?: string[]; isActive?: boolean; description?: string }
  ): Promise<any>;
  deleteWebhook(userId: string, webhookId: string): Promise<void>;
  getWebhookDeliveries(
    userId: string,
    webhookId: string,
    params: { page: number; limit: number }
  ): Promise<any>;
}
