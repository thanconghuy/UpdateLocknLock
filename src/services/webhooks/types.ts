// Định nghĩa các types cho webhook
export interface WooCommerceWebhookProduct {
  id: number;
  name: string;
  regular_price: string;
  sale_price: string | null;
  sku: string;
  categories: Array<{name: string}>;
  images: Array<{src: string}>;
  permalink: string;
  description: string;
}

export type WebhookTopic = 
  | 'product.created' 
  | 'product.updated' 
  | 'product.deleted';

export interface WebhookHeaders {
  'x-wc-webhook-topic': WebhookTopic;
  'x-wc-webhook-signature': string;
}