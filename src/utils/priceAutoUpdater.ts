// Auto price updater utility
// Automatically calculates prices based on brand data

export interface BrandPriceData {
  shopeePrice?: number
  shopeeLink?: string
  lazadaPrice?: number
  lazadaLink?: string
  dmxPrice?: number
  dmxLink?: string
  tikiPrice?: number
  tikiLink?: string
}

export interface AutoPriceResult {
  suggestedRegularPrice: number | null
  suggestedPromotionalPrice: number | null
  suggestedExternalUrl: string | null
  lowestPriceBrand: string | null
  highestPriceBrand: string | null
}

/**
 * Auto-update prices based on brand data
 * Rules:
 * - Regular price: Highest price among all brands
 * - Promotional price: Lowest price among all brands  
 * - External URL: Link of the brand with lowest price
 */
export function calculateAutoPrice(brandData: BrandPriceData): AutoPriceResult {
  const brands = [
    { name: 'shopee', price: brandData.shopeePrice, link: brandData.shopeeLink },
    { name: 'lazada', price: brandData.lazadaPrice, link: brandData.lazadaLink },
    { name: 'dmx', price: brandData.dmxPrice, link: brandData.dmxLink },
    { name: 'tiki', price: brandData.tikiPrice, link: brandData.tikiLink }
  ]

  // Filter out brands with no valid price
  const validBrands = brands.filter(brand => brand.price && brand.price > 0)

  if (validBrands.length === 0) {
    return {
      suggestedRegularPrice: null,
      suggestedPromotionalPrice: null,
      suggestedExternalUrl: null,
      lowestPriceBrand: null,
      highestPriceBrand: null
    }
  }

  // Find highest and lowest prices
  const highestPriceBrand = validBrands.reduce((prev, current) => 
    (current.price! > prev.price!) ? current : prev
  )
  
  const lowestPriceBrand = validBrands.reduce((prev, current) => 
    (current.price! < prev.price!) ? current : prev
  )

  return {
    suggestedRegularPrice: highestPriceBrand.price!,
    suggestedPromotionalPrice: lowestPriceBrand.price!,
    suggestedExternalUrl: lowestPriceBrand.link || null,
    lowestPriceBrand: lowestPriceBrand.name,
    highestPriceBrand: highestPriceBrand.name
  }
}

/**
 * Check if a product needs price auto-update
 */
export function shouldAutoUpdatePrice(product: any): boolean {
  // Auto-update if regular price is missing or zero
  return !product.price || product.price === 0
}

/**
 * Apply auto-update to product data
 * This is the main function to be used in edit forms
 */
export function applyAutoUpdateIfNeeded(product: any): {
  updatedProduct: any
  wasUpdated: boolean
  updateSummary: string
} {
  if (!shouldAutoUpdatePrice(product)) {
    return {
      updatedProduct: product,
      wasUpdated: false,
      updateSummary: 'Không cần cập nhật - đã có giá thường'
    }
  }

  const brandData: BrandPriceData = {
    shopeePrice: product.gia_shopee || product.shopee_price,
    shopeeLink: product.link_shopee || product.shopee_link,
    lazadaPrice: product.gia_lazada || product.lazada_price,
    lazadaLink: product.link_lazada || product.lazada_link,
    dmxPrice: product.gia_dmx || product.dmx_price,
    dmxLink: product.link_dmx || product.dmx_link,
    tikiPrice: product.gia_tiki || product.tiki_price,
    tikiLink: product.link_tiki || product.tiki_link
  }

  const autoResult = calculateAutoPrice(brandData)

  if (!autoResult.suggestedRegularPrice) {
    return {
      updatedProduct: product,
      wasUpdated: false,
      updateSummary: 'Không có giá từ brands để cập nhật'
    }
  }

  const updatedProduct = {
    ...product,
    price: autoResult.suggestedRegularPrice,
    promotional_price: autoResult.suggestedPromotionalPrice,
    external_url: autoResult.suggestedExternalUrl || product.external_url
  }

  const updateSummary = [
    `✅ Giá thường: ${autoResult.suggestedRegularPrice?.toLocaleString('vi-VN')}₫ (từ ${autoResult.highestPriceBrand})`,
    autoResult.suggestedPromotionalPrice ? `✅ Giá KM: ${autoResult.suggestedPromotionalPrice?.toLocaleString('vi-VN')}₫ (từ ${autoResult.lowestPriceBrand})` : '',
    autoResult.suggestedExternalUrl ? `✅ URL: từ ${autoResult.lowestPriceBrand}` : ''
  ].filter(Boolean).join('\n')

  return {
    updatedProduct,
    wasUpdated: true,
    updateSummary
  }
}

/**
 * Batch update multiple products
 * For future mass update functionality
 */
export function batchAutoUpdate(products: any[]): {
  updatedProducts: any[]
  updateCount: number
  updateSummary: string
} {
  let updateCount = 0
  const updates: string[] = []

  const updatedProducts = products.map((product, index) => {
    const result = applyAutoUpdateIfNeeded(product)
    if (result.wasUpdated) {
      updateCount++
      updates.push(`Sản phẩm ${index + 1}: ${result.updateSummary}`)
    }
    return result.updatedProduct
  })

  return {
    updatedProducts,
    updateCount,
    updateSummary: updateCount > 0 ? updates.join('\n\n') : 'Không có sản phẩm nào cần cập nhật'
  }
}