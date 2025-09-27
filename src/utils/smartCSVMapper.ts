import type { CSVRow, ProductData } from '../types'

// Normalize text for better matching (remove diacritics, spaces, case)
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Keep only alphanumeric
}

// Smart field detection using multiple strategies
function detectField(columns: string[], patterns: string[], contentHints?: string[]): string | undefined {
  const normalizedColumns = columns.map(col => ({
    original: col,
    normalized: normalizeText(col),
    lower: col.toLowerCase()
  }))

  // Strategy 1: Exact match (case insensitive)
  for (const pattern of patterns) {
    const found = normalizedColumns.find(col => 
      col.normalized === normalizeText(pattern) ||
      col.lower === pattern.toLowerCase()
    )
    if (found) return found.original
  }

  // Strategy 2: Contains match
  for (const pattern of patterns) {
    const normalizedPattern = normalizeText(pattern)
    const found = normalizedColumns.find(col => 
      col.normalized.includes(normalizedPattern) ||
      col.lower.includes(pattern.toLowerCase())
    )
    if (found) return found.original
  }

  // Strategy 3: Partial match (for compound words)
  for (const pattern of patterns) {
    const words = pattern.toLowerCase().split(/[^a-z0-9]/g).filter(Boolean)
    const found = normalizedColumns.find(col => 
      words.every(word => col.lower.includes(word))
    )
    if (found) return found.original
  }

  return undefined
}

// Get field value with fallback options
function getFieldValue(row: CSVRow, fieldName: string | undefined): string | undefined {
  if (!fieldName || !row[fieldName]) return undefined
  const value = row[fieldName].trim()
  return value === '' ? undefined : value
}

// Parse price from Vietnamese format
function parseVietnamesePrice(value: string | undefined): number | undefined {
  if (!value) return undefined
  
  // Remove common Vietnamese currency symbols and separators
  const cleaned = value
    .replace(/[₫$€¥]/g, '') // Currency symbols
    .replace(/[.,\s]/g, '') // Dots, commas, spaces
    .replace(/[^\d]/g, '') // Keep only digits
  
  const parsed = parseInt(cleaned, 10)
  return isNaN(parsed) || parsed === 0 ? undefined : parsed
}

export function smartMapCSVRow(row: CSVRow, index: number): ProductData {
  const columns = Object.keys(row)
  
  // Define field patterns with Vietnamese and English variants
  const fieldPatterns = {
    // Note: 'id' from CSV should map to websiteId, not database id
    websiteId: ['id', 'ID', 'product_id', 'website_id', 'site_id', 'external_id', 'web_id', 'id website', 'stt', 'số thứ tự'],
    title: [
      'title', 'name', 'product_name', 'post_title',
      'tên', 'ten', 'tên sản phẩm', 'ten san pham',
      'tên sp', 'ten sp', 'product name', 'Title'
    ],
    price: [
      'price', 'regular_price', 'gia', 'giá', 'gia thuong',
      'giá thường', 'regular price', 'Price', 'gia goc', 'giá gốc'
    ],
    promotionalPrice: [
      'sale_price', 'promotional_price', 'discount_price',
      'gia km', 'giá km', 'gia khuyen mai', 'giá khuyến mãi',
      'gia sale', 'giá sale', 'sale price', 'promotional price'
    ],
    category: [
      'category', 'categories', 'danh muc', 'danh mục',
      'phan loai', 'phân loại', 'the loai', 'thể loại', 'Category'
    ],
    sku: [
      'sku', 'SKU', 'ma sp', 'mã sp', 'ma san pham', 'mã sản phẩm',
      'product_code', 'product code', 'ma hang', 'mã hàng'
    ],
    imageUrl: [
      'image', 'image_url', 'hinh anh', 'hình ảnh', 'anh', 'ảnh',
      'thumbnail', 'photo', 'picture', 'Image', 'hinh'
    ],
    externalUrl: [
      'url', 'link', 'external_url', 'product_url',
      'lien ket', 'liên kết', 'duong dan', 'đường dẫn'
    ]
  }

  // Platform specific patterns
  const platformPatterns = {
    linkShopee: ['link_shopee', 'shopee_link', 'link shopee', 'shopee link', 'Link Shopee'],
    giaShopee: ['gia_shopee', 'shopee_price', 'gia shopee', 'giá shopee', 'shopee price', 'Giá Shopee'],
    linkTiktok: ['link_tiktok', 'tiktok_link', 'link tiktok', 'tiktok link', 'Link TikTok'],
    giaTiktok: ['gia_tiktok', 'tiktok_price', 'gia tiktok', 'giá tiktok', 'tiktok price', 'Giá TikTok'],
    linkLazada: ['link_lazada', 'lazada_link', 'link lazada', 'lazada link', 'Link Lazada'],
    giaLazada: ['gia_lazada', 'lazada_price', 'gia lazada', 'giá lazada', 'lazada price', 'Giá Lazada'],
    linkDmx: ['link_dmx', 'dmx_link', 'link dmx', 'dmx link', 'Link DMX'],
    giaDmx: ['gia_dmx', 'dmx_price', 'gia dmx', 'giá dmx', 'dmx price', 'Giá DMX'],
    linkTiki: ['link_tiki', 'tiki_link', 'link tiki', 'tiki link', 'Link Tiki'],
    giaTiki: ['gia_tiki', 'tiki_price', 'gia tiki', 'giá tiki', 'tiki price', 'Giá Tiki']
  }

  // Detect fields
  const detectedFields: Record<string, string | undefined> = {}
  
  // Detect basic fields
  Object.entries(fieldPatterns).forEach(([key, patterns]) => {
    detectedFields[key] = detectField(columns, patterns)
  })
  
  // Detect platform fields
  Object.entries(platformPatterns).forEach(([key, patterns]) => {
    detectedFields[key] = detectField(columns, patterns)
  })

  // Map to ProductData
  const result: ProductData = {
    // Database ID will be auto-generated, don't use CSV id
    id: `csv_${index + 1}_${Date.now()}`, // Generate unique database ID
    websiteId: getFieldValue(row, detectedFields.websiteId) || '', // This gets the actual CSV id/product_id
    title: getFieldValue(row, detectedFields.title) || '',
    price: parseVietnamesePrice(getFieldValue(row, detectedFields.price)) || 0,
    promotionalPrice: parseVietnamesePrice(getFieldValue(row, detectedFields.promotionalPrice)),
    externalUrl: getFieldValue(row, detectedFields.externalUrl),
    category: getFieldValue(row, detectedFields.category),
    imageUrl: getFieldValue(row, detectedFields.imageUrl),
    sku: getFieldValue(row, detectedFields.sku) || '',
    // Platform data
    linkShopee: getFieldValue(row, detectedFields.linkShopee),
    giaShopee: parseVietnamesePrice(getFieldValue(row, detectedFields.giaShopee)),
    linkTiktok: getFieldValue(row, detectedFields.linkTiktok),
    giaTiktok: parseVietnamesePrice(getFieldValue(row, detectedFields.giaTiktok)),
    linkLazada: getFieldValue(row, detectedFields.linkLazada),
    giaLazada: parseVietnamesePrice(getFieldValue(row, detectedFields.giaLazada)),
    linkDmx: getFieldValue(row, detectedFields.linkDmx),
    giaDmx: parseVietnamesePrice(getFieldValue(row, detectedFields.giaDmx)),
    linkTiki: getFieldValue(row, detectedFields.linkTiki),
    giaTiki: parseVietnamesePrice(getFieldValue(row, detectedFields.giaTiki))
  }

  return result
}

export function smartMapCSVData(csvData: CSVRow[]): ProductData[] {
  return csvData.map((row, index) => smartMapCSVRow(row, index))
}

// Debug function to show field detection results
export function debugFieldDetection(csvData: CSVRow[]): void {
  if (csvData.length === 0) return
  
  const firstRow = csvData[0]
  const columns = Object.keys(firstRow)
  
  console.log('🔍 Smart Field Detection Results:')
  console.log('Available columns:', columns)
  
  const mapped = smartMapCSVRow(firstRow, 0)
  
  console.log('\nDetected mappings:')
  Object.entries(mapped).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      console.log(`✅ ${key}: ${value}`)
    } else {
      console.log(`❌ ${key}: (not found)`)
    }
  })
}