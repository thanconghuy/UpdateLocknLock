/**
 * Parse price text formats like "495.000₫", "495,000", "495000" to number
 */
export function parsePriceText(priceText: string | number): number {
  if (typeof priceText === 'number') {
    return priceText
  }
  
  if (!priceText || typeof priceText !== 'string') {
    return 0
  }
  
  // Remove currency symbols, spaces, and common formatting
  const cleanText = priceText
    .replace(/[₫$€£¥]/g, '') // Remove currency symbols
    .replace(/\s/g, '') // Remove spaces
    .replace(/,/g, '') // Remove commas
    .replace(/\./g, '') // Remove dots (thousand separators in Vietnamese format)
    .trim()
  
  const parsed = parseFloat(cleanText)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Format number to Vietnamese price format with dots as thousand separators
 */
export function formatPriceToText(price: number): string {
  if (!price || price === 0) return '0'
  return new Intl.NumberFormat('vi-VN', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(price)
}

/**
 * Format number to Vietnamese price format with currency
 */
export function formatPriceWithCurrency(price: number): string {
  if (!price || price === 0) return '0₫'
  return formatPriceToText(price) + '₫'
}