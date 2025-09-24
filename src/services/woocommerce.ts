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
  stock_status?: 'instock' | 'outofstock' | 'onbackorder'
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
  stock_status?: 'instock' | 'outofstock' | 'onbackorder'
  stock_quantity?: number | null
  manage_stock?: boolean
  description?: string
  short_description?: string
  permalink?: string
  categories?: Array<{
    id: number
    name: string
    slug: string
  }>
  images?: Array<{
    id: number
    src: string
    name?: string
    alt?: string
  }>
  meta_data: Array<{
    id: number
    key: string
    value: string
  }>
}

export interface GetProductsParams {
  page?: number
  per_page?: number
  search?: string
  status?: 'draft' | 'pending' | 'private' | 'publish'
  category?: string
  sku?: string
  featured?: boolean
  orderby?: 'date' | 'id' | 'include' | 'title' | 'slug'
  order?: 'asc' | 'desc'
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

  async getProducts(params: GetProductsParams = {}): Promise<WooCommerceProductResponse[]> {
    try {
      const queryParams = new URLSearchParams()

      // Set default parameters
      queryParams.append('per_page', (params.per_page || 10).toString())
      queryParams.append('page', (params.page || 1).toString())

      // Add optional parameters
      if (params.search) queryParams.append('search', params.search)
      if (params.status) queryParams.append('status', params.status)
      if (params.category) queryParams.append('category', params.category)
      if (params.sku) queryParams.append('sku', params.sku)
      if (params.featured !== undefined) queryParams.append('featured', params.featured.toString())
      if (params.orderby) queryParams.append('orderby', params.orderby)
      if (params.order) queryParams.append('order', params.order)

      const response = await this.api.get(`/products?${queryParams.toString()}`)

      if (response.status === 200) {
        // Debug: Log first product structure
        if (response.data && response.data[0]) {
          console.log('🔍 DEBUG WooAPI: First product structure:', {
            id: response.data[0].id,
            name: response.data[0].name,
            meta_data: response.data[0].meta_data,
            meta_data_length: response.data[0].meta_data?.length
          })
        }
        return response.data as WooCommerceProductResponse[]
      }
      return []
    } catch (error) {
      console.error('Failed to fetch products:', error)
      return []
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
      sku: wooProduct.sku || '',
      // Stock status from custom field and WooCommerce stock_status
      hetHang: wooProduct.stock_status === 'outofstock' // Default from WooCommerce stock_status
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
          case 'het_hang':
            // Handle text values: "Còn hàng" or "Hết hàng" (case-insensitive)
            const value = String(meta.value).trim()
            console.log('🔍 WooCommerce het_hang value:', value)
            // Convert to boolean: "Hết hàng" = true (out of stock), "Còn hàng" = false (in stock)
            productData.hetHang = value === 'Hết hàng'
            console.log('🔍 Converted to boolean:', productData.hetHang)
            break
          case 'so_luong_ton':
            // Handle stock quantity
            productData.soLuongTon = parseInt(meta.value) || 0
            break
        }
      })
    }

    // Sync stock quantity from WooCommerce if available
    if (wooProduct.stock_quantity !== undefined && wooProduct.stock_quantity !== null) {
      productData.soLuongTon = wooProduct.stock_quantity
    }

    // Ensure consistency between het_hang and stock_status
    // Priority: het_hang custom field > WooCommerce stock_status
    if (productData.hetHang === undefined) {
      productData.hetHang = wooProduct.stock_status === 'outofstock'
    }

    console.log('🔍 Final product stock status:', {
      het_hang: productData.hetHang,
      stock_status: wooProduct.stock_status,
      stock_quantity: productData.soLuongTon
    })

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

    // Handle het_hang custom field and stock_status mapping
    if (productData.hetHang !== undefined) {
      // Map het_hang boolean to text value
      const hetHangText = productData.hetHang ? 'Hết hàng' : 'Còn hàng'
      metaData.push({ key: 'het_hang', value: hetHangText })

      // Set WooCommerce stock_status based on het_hang value
      payload.stock_status = productData.hetHang ? 'outofstock' : 'instock'

      console.log('🔍 Mapping het_hang:', {
        boolean: productData.hetHang,
        text: hetHangText,
        stock_status: payload.stock_status
      })
    }

    // Handle stock quantity
    if (productData.soLuongTon !== undefined && productData.soLuongTon !== null) {
      metaData.push({ key: 'so_luong_ton', value: productData.soLuongTon.toString() })
    }

    if (metaData.length > 0) {
      payload.meta_data = metaData
    }

    return payload
  }
}

export const wooCommerceService = new WooCommerceService()