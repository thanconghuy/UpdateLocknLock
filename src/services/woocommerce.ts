import axios from 'axios'
import type { ProductData } from '../types'
import { parsePriceText, formatPriceToText } from '../utils/priceUtils'
import { ENV } from '../config/env'

const WOOCOMMERCE_CONFIG = {
  baseUrl: ENV.WOOCOMMERCE_BASE_URL,
  consumerKey: ENV.WOOCOMMERCE_CONSUMER_KEY,
  consumerSecret: ENV.WOOCOMMERCE_CONSUMER_SECRET
}

export type WooCommerceProduct = {
  type?: string
  external_url?: string
  button_text?: string
  regular_price?: string
  sale_price?: string
  sku?: string
  meta_data?: Array<{
    key: string
    value: string
  }>
}

export type WooCommerceProductResponse = {
  id: number
  name: string
  type: string
  external_url: string
  sku: string
  regular_price: string
  sale_price: string
  meta_data: Array<{
    id: number
    key: string
    value: string
  }>
}

export class WooCommerceService {
  private api = axios.create({
    baseURL: `${WOOCOMMERCE_CONFIG.baseUrl}/wp-json/wc/v3`,
    auth: {
      username: WOOCOMMERCE_CONFIG.consumerKey,
      password: WOOCOMMERCE_CONFIG.consumerSecret
    },
    headers: {
      'Content-Type': 'application/json'
    }
  })

  async updateProduct(productId: string, productData: ProductData): Promise<boolean> {
    try {
      const payload: WooCommerceProduct = this.mapProductData(productData)
      
      const response = await this.api.put(`/products/${productId}`, payload)
      
      return response.status === 200
    } catch (error) {
      console.error(`Failed to update product ${productId}:`, error)
      return false
    }
  }

  async getProduct(productId: string): Promise<ProductData | null> {
    try {
      const response = await this.api.get(`/products/${productId}`)
      
      if (response.status === 200) {
        return this.mapWooCommerceToProductData(response.data)
      }
      return null
    } catch (error) {
      console.error(`Failed to fetch product ${productId}:`, error)
      return null
    }
  }

  private mapWooCommerceToProductData(wooProduct: WooCommerceProductResponse): ProductData {
    const productData: ProductData = {
      id: '', // Will be set by caller
      websiteId: wooProduct.id.toString(),
      title: wooProduct.name,
      price: parsePriceText(wooProduct.regular_price),
      promotionalPrice: parsePriceText(wooProduct.sale_price),
      externalUrl: wooProduct.external_url || '',
      sku: wooProduct.sku || ''
    }

    // Extract platform data from meta_data
    if (wooProduct.meta_data) {
      wooProduct.meta_data.forEach(meta => {
        switch (meta.key) {
          case 'link_tiktok':
            productData.linkTiktok = meta.value
            break
          case 'gia_tiktok':
            productData.giaTiktok = parsePriceText(meta.value)
            break
          case 'link_dmx':
            productData.linkDmx = meta.value
            break
          case 'gia_dmx':
            productData.giaDmx = parsePriceText(meta.value)
            break
          case 'link_lazada':
            productData.linkLazada = meta.value
            break
          case 'gia_lazada':
            productData.giaLazada = parsePriceText(meta.value)
            break
          case 'link_shopee':
            productData.linkShopee = meta.value
            break
          case 'gia_shopee':
            productData.giaShopee = parsePriceText(meta.value)
            break
          case 'link_tiki':
            productData.linkTiki = meta.value
            break
          case 'gia_tiki':
            productData.giaTiki = parsePriceText(meta.value)
            break
        }
      })
    }

    return productData
  }

  private mapProductData(productData: ProductData): WooCommerceProduct {
    const payload: WooCommerceProduct = {}

    if (productData.externalUrl) {
      payload.type = 'external'
      payload.external_url = productData.externalUrl
      
      // Determine button text based on the external URL
      const url = productData.externalUrl.toLowerCase()
      let buttonText = 'Mua ngay'
      
      if (url.includes('shopee.vn') || url.includes('shopee.com')) {
        buttonText = 'Mua tại Shopee'
      } else if (url.includes('tiktok.com') || url.includes('tiktokshop')) {
        buttonText = 'Mua tại TikTok'
      } else if (url.includes('lazada.vn') || url.includes('lazada.com')) {
        buttonText = 'Mua tại Lazada'
      } else if (url.includes('dienmayxanh.com') || url.includes('dmx')) {
        buttonText = 'Mua tại Điện máy xanh'
      } else if (url.includes('tiki.vn') || url.includes('tiki.com')) {
        buttonText = 'Mua tại Tiki'
      }
      
      payload.button_text = buttonText
    }

    if (productData.price) {
      payload.regular_price = productData.price.toString()
    }

    if (productData.promotionalPrice) {
      payload.sale_price = productData.promotionalPrice.toString()
    }

    if (productData.sku) {
      payload.sku = productData.sku
    }

    const metaData: Array<{ key: string; value: string }> = []

    if (productData.linkTiktok) {
      metaData.push({ key: 'link_tiktok', value: productData.linkTiktok })
    }
    if (productData.giaTiktok) {
      metaData.push({ key: 'gia_tiktok', value: formatPriceToText(productData.giaTiktok) })
    }

    if (productData.linkDmx) {
      metaData.push({ key: 'link_dmx', value: productData.linkDmx })
    }
    if (productData.giaDmx) {
      metaData.push({ key: 'gia_dmx', value: formatPriceToText(productData.giaDmx) })
    }

    if (productData.linkLazada) {
      metaData.push({ key: 'link_lazada', value: productData.linkLazada })
    }
    if (productData.giaLazada) {
      metaData.push({ key: 'gia_lazada', value: formatPriceToText(productData.giaLazada) })
    }

    if (productData.linkShopee) {
      metaData.push({ key: 'link_shopee', value: productData.linkShopee })
    }
    if (productData.giaShopee) {
      metaData.push({ key: 'gia_shopee', value: formatPriceToText(productData.giaShopee) })
    }

    if (productData.linkTiki) {
      metaData.push({ key: 'link_tiki', value: productData.linkTiki })
    }
    if (productData.giaTiki) {
      metaData.push({ key: 'gia_tiki', value: formatPriceToText(productData.giaTiki) })
    }

    if (metaData.length > 0) {
      payload.meta_data = metaData
    }

    return payload
  }
}

export const wooCommerceService = new WooCommerceService()