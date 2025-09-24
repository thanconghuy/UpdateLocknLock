import { WebhookHandler } from './WebhookHandler';
import { verifyWebhookSignature } from './security';
import { WooCommerceWebhookProduct, WebhookHeaders } from './types';

export class WebhookService {
  private handler: WebhookHandler;

  constructor() {
    this.handler = new WebhookHandler();
  }

  /**
   * Xử lý webhook request
   */
  public async processWebhook(
    body: WooCommerceWebhookProduct,
    headers: WebhookHeaders
  ) {
    // Xác thực webhook
    const isValid = verifyWebhookSignature(
      JSON.stringify(body),
      headers,
      process.env.VITE_WEBHOOK_SECRET || ''
    );

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    // Xử lý webhook
    return this.handler.handleWebhook(body, headers);
  }
}