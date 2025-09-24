import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ENV } from '../../config/env';
import { WooCommerceWebhookProduct, WebhookHeaders, WebhookTopic } from './types';
import { detectPlatformLinks } from '../../utils/links';
import { parsePriceText } from '../../utils/priceUtils';

export class WebhookHandler {
  private supabase: SupabaseClient;
  private auditEnabled: boolean;

  constructor() {
    if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase configuration');
    }
    this.supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
    this.auditEnabled = true;
  }

  /**
   * Xử lý webhook từ WooCommerce
   */
  public async handleWebhook(
    product: WooCommerceWebhookProduct,
    headers: WebhookHeaders
  ) {
    if (!product || !headers) {
      throw new Error('Invalid webhook data');
    }

    try {
      const topic = headers['x-wc-webhook-topic'];
      
      switch (topic) {
        case 'product.created':
        case 'product.updated':
          return await this.handleProductUpdate(product);
        case 'product.deleted':
          return await this.handleProductDelete(product.id);
        default:
          throw new Error(`Unsupported webhook topic: ${topic}`);
      }
    } catch (error) {
      console.error('Webhook handling error:', {
        error,
        productId: product.id,
        topic: headers['x-wc-webhook-topic']
      });
      throw error;
    }
  }

  /**
   * Xử lý cập nhật/tạo mới sản phẩm
   */
  private async handleProductUpdate(product: WooCommerceWebhookProduct) {
    if (!product.id) {
      throw new Error('Product ID is required');
    }

    try {
      const platformLinks = detectPlatformLinks(product.description || '');
    
      const productData = {
        website_id: product.id.toString(),
        title: product.name?.trim() || '',
        price: parsePriceText(product.regular_price || '0'),
        promotional_price: parsePriceText(product.sale_price || '0'),
        sku: product.sku?.trim() || '',
        category: Array.isArray(product.categories) 
          ? product.categories.map(c => c.name?.trim()).filter(Boolean).join(', ')
          : '',
        image_url: product.images?.[0]?.src?.trim() || '',
        external_url: product.permalink?.trim() || '',
        link_shopee: platformLinks.shopee?.trim() || '',
        link_tiktok: platformLinks.tiktok?.trim() || '',
        link_lazada: platformLinks.lazada?.trim() || '',
        link_dmx: platformLinks.dmx?.trim() || '',
        link_tiki: platformLinks.tiki?.trim() || '',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from(ENV.DEFAULT_PRODUCTS_TABLE)
        .upsert(productData, {
          onConflict: 'website_id'
        });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (this.auditEnabled) {
        await this.createAuditLog({
          product_id: product.id,
          action: 'webhook_update',
          changes: {
            old: null,
            new: productData
          },
          source: 'woocommerce_webhook'
        });
      }

      return data;
    } catch (error) {
      console.error('Product update error:', {
        error,
        productId: product.id
      });
      throw error;
    }
  }

  /**
   * Xử lý xóa sản phẩm
   */
  private async handleProductDelete(productId: number) {
    if (!productId) {
      throw new Error('Product ID is required for deletion');
    }

    try {
      const { error } = await this.supabase
        .from(ENV.DEFAULT_PRODUCTS_TABLE)
        .delete()
        .eq('website_id', productId.toString());

      if (error) {
        throw new Error(`Delete error: ${error.message}`);
      }

      if (this.auditEnabled) {
        await this.createAuditLog({
          product_id: productId,
          action: 'webhook_delete',
          changes: null,
          source: 'woocommerce_webhook'
        });
      }

      return true;
    } catch (error) {
      console.error('Product delete error:', {
        error,
        productId
      });
      throw error;
    }
  }

  /**
   * Tạo audit log
   */
  private async createAuditLog(logData: {
    product_id: number;
    action: string;
    changes: any;
    source: string;
  }) {
    if (!logData.product_id || !logData.action) {
      console.warn('Invalid audit log data', logData);
      return;
    }

    try {
      const { error } = await this.supabase
        .from(ENV.DEFAULT_AUDIT_TABLE)
        .insert([{
          product_id: logData.product_id,
          action: logData.action,
          changes: logData.changes,
          source: logData.source,
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.warn('Audit log creation failed:', error);
      }
    } catch (error) {
      console.warn('Audit log error:', error);
    }
  }
}