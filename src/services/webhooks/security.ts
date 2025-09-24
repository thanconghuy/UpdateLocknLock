import crypto from 'crypto';
import { WebhookHeaders } from './types';

export function verifyWebhookSignature(
  payload: string,
  headers: WebhookHeaders,
  secret: string
): boolean {
  // Kiểm tra xem có signature header không
  const signature = headers['x-wc-webhook-signature'];
  if (!signature) {
    return false;
  }

  // Tạo HMAC
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');

  // So sánh với signature từ header
  return hmac === signature;
}