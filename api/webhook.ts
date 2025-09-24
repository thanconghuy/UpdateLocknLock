// Endpoint xử lý webhook từ WooCommerce
import { WebhookService } from '../services/webhooks/WebhookService';
import { WooCommerceWebhookProduct, WebhookHeaders } from '../services/webhooks/types';

export default async function handler(req: any, res: any) {
  // Chỉ chấp nhận POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const webhookService = new WebhookService();
    
    // Xử lý webhook
    await webhookService.processWebhook(
      req.body as WooCommerceWebhookProduct,
      req.headers as WebhookHeaders
    );

    // Trả về thành công
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    
    // Trả về lỗi
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

// npm ci