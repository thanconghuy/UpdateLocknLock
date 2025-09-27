import type { CSVRow, ProductData } from '../types'

// Common field mappings for different CSV formats
const FIELD_MAPPINGS = {
  // ID mappings
  id: ['id', 'product_id', 'ID', 'Product ID'],
  websiteId: ['website_id', 'site_id', 'external_id', 'web_id'],
  
  // Title/Name mappings
  title: ['title', 'name', 'product_name', 'Name', 'Title', 'Product Name'],
  
  // Price mappings
  price: ['price', 'regular_price', 'Price', 'Regular Price', 'Giá thường'],
  promotionalPrice: ['sale_price', 'promotional_price', 'discount_price', 'Sale Price', 'Giá khuyến mãi'],
  
  // URL mappings
  externalUrl: ['url', 'external_url', 'product_url', 'link', 'URL', 'Link'],
  
  // Category mappings
  category: ['category', 'categories', 'Category', 'Categories', 'Danh mục'],
  
  // Image mappings
  imageUrl: ['image', 'image_url', 'thumbnail', 'Image', 'Image URL', 'Hình ảnh'],
  
  // SKU mappings
  sku: ['sku', 'SKU', 'product_code', 'code'],
  
  // Platform link mappings
  linkShopee: ['link_shopee', 'shopee_link', 'Link Shopee'],
  giaShopee: ['gia_shopee', 'shopee_price', 'Giá Shopee'],
  linkTiktok: ['link_tiktok', 'tiktok_link', 'Link TikTok'],
  giaTiktok: ['gia_tiktok', 'tiktok_price', 'Giá TikTok'],
  linkLazada: ['link_lazada', 'lazada_link', 'Link Lazada'],
  giaLazada: ['gia_lazada', 'lazada_price', 'Giá Lazada'],
  linkDmx: ['link_dmx', 'dmx_link', 'Link DMX'],
  giaDmx: ['gia_dmx', 'dmx_price', 'Giá DMX'],
  linkTiki: ['link_tiki', 'tiki_link', 'Link Tiki'],
  giaTiki: ['gia_tiki', 'tiki_price', 'Giá Tiki']
}

function findFieldValue(row: CSVRow, fieldMappings: string[]): string | undefined {
  for (const mapping of fieldMappings) {
    if (row[mapping] !== undefined && row[mapping] !== '') {
      return row[mapping]
    }
  }
  return undefined
}

function parsePrice(priceStr: string | undefined): number | undefined {
  if (!priceStr) return undefined
  
  // Remove common currency symbols and formatting
  const cleanPrice = priceStr.replace(/[₫$,\s]/g, '').replace(/\./g, '')
  const parsed = parseFloat(cleanPrice)
  
  return isNaN(parsed) ? undefined : parsed
}

export function mapCSVRowToProductData(row: CSVRow, index: number): ProductData {
  return {
    id: findFieldValue(row, FIELD_MAPPINGS.id) || String(index + 1),
    websiteId: findFieldValue(row, FIELD_MAPPINGS.websiteId) || '',
    title: findFieldValue(row, FIELD_MAPPINGS.title) || '',
    price: parsePrice(findFieldValue(row, FIELD_MAPPINGS.price)) || 0,
    promotionalPrice: parsePrice(findFieldValue(row, FIELD_MAPPINGS.promotionalPrice)),
    externalUrl: findFieldValue(row, FIELD_MAPPINGS.externalUrl),
    category: findFieldValue(row, FIELD_MAPPINGS.category),
    imageUrl: findFieldValue(row, FIELD_MAPPINGS.imageUrl),
    sku: findFieldValue(row, FIELD_MAPPINGS.sku) || '',
    // Platform data
    linkShopee: findFieldValue(row, FIELD_MAPPINGS.linkShopee),
    giaShopee: parsePrice(findFieldValue(row, FIELD_MAPPINGS.giaShopee)),
    linkTiktok: findFieldValue(row, FIELD_MAPPINGS.linkTiktok),
    giaTiktok: parsePrice(findFieldValue(row, FIELD_MAPPINGS.giaTiktok)),
    linkLazada: findFieldValue(row, FIELD_MAPPINGS.linkLazada),
    giaLazada: parsePrice(findFieldValue(row, FIELD_MAPPINGS.giaLazada)),
    linkDmx: findFieldValue(row, FIELD_MAPPINGS.linkDmx),
    giaDmx: parsePrice(findFieldValue(row, FIELD_MAPPINGS.giaDmx)),
    linkTiki: findFieldValue(row, FIELD_MAPPINGS.linkTiki),
    giaTiki: parsePrice(findFieldValue(row, FIELD_MAPPINGS.giaTiki))
  }
}

export function mapCSVDataToProducts(csvData: CSVRow[]): ProductData[] {
  return csvData.map((row, index) => mapCSVRowToProductData(row, index))
}