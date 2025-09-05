import type { CSVRow, ProductData } from '../types'
import { mapCSVRowToProductData } from './csvMapper'

export function debugCSVMapping(csvData: CSVRow[]): void {
  if (csvData.length === 0) {
    console.log('❌ No CSV data to debug')
    return
  }

  console.log('🔍 CSV Debug Analysis')
  console.log('='.repeat(50))
  
  // 1. Show available columns
  const firstRow = csvData[0]
  const availableColumns = Object.keys(firstRow)
  console.log('📊 Available CSV columns:', availableColumns.length)
  availableColumns.forEach((col, index) => {
    console.log(`  ${index + 1}. "${col}"`)
  })
  
  console.log('\n📝 Sample data from first row:')
  availableColumns.forEach(col => {
    const value = firstRow[col]
    console.log(`  "${col}": "${value}"`)
  })
  
  // 2. Test mapping
  console.log('\n🔄 Testing field mapping on first row:')
  const mappedData = mapCSVRowToProductData(firstRow, 0)
  
  console.log('Mapped ProductData:')
  Object.entries(mappedData).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      console.log(`  ✅ ${key}: ${value}`)
    } else {
      console.log(`  ❌ ${key}: (empty/null)`)
    }
  })
  
  // 3. Look for potential matches
  console.log('\n🔍 Potential field matches:')
  const fieldPatterns = {
    title: /title|name|tên|tênsảnphẩm|product.*name/i,
    price: /price|giá|gia|cost|regular.*price/i,
    promotionalPrice: /sale.*price|promotional|discount|khuyến.*mãi|giá.*km/i,
    shopeeLink: /shopee.*link|link.*shopee/i,
    shopeePrice: /shopee.*price|gia.*shopee|giá.*shopee/i,
    tiktokLink: /tiktok.*link|link.*tiktok/i,
    tiktokPrice: /tiktok.*price|gia.*tiktok|giá.*tiktok/i,
    lazadaLink: /lazada.*link|link.*lazada/i,
    lazadaPrice: /lazada.*price|gia.*lazada|giá.*lazada/i,
    dmxLink: /dmx.*link|link.*dmx/i,
    dmxPrice: /dmx.*price|gia.*dmx|giá.*dmx/i,
    category: /category|categories|danh.*mục|phân.*loại/i,
    sku: /sku|mã.*sản.*phẩm|product.*code/i,
    imageUrl: /image|hình.*ảnh|thumbnail|photo/i
  }
  
  Object.entries(fieldPatterns).forEach(([field, pattern]) => {
    const matches = availableColumns.filter(col => pattern.test(col))
    if (matches.length > 0) {
      console.log(`  🎯 ${field}: ${matches.join(', ')}`)
    } else {
      console.log(`  ❌ ${field}: No matches found`)
    }
  })
  
  // 4. Check for common Vietnamese field names
  console.log('\n🇻🇳 Vietnamese field name detection:')
  const vietnameseFields = availableColumns.filter(col => 
    /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(col)
  )
  if (vietnameseFields.length > 0) {
    vietnameseFields.forEach(field => {
      console.log(`  🇻🇳 "${field}": "${firstRow[field]}"`)
    })
  } else {
    console.log('  No Vietnamese field names detected')
  }
  
  console.log('\n' + '='.repeat(50))
}

export function suggestFieldMappings(csvData: CSVRow[]): Record<string, string[]> {
  if (csvData.length === 0) return {}
  
  const availableColumns = Object.keys(csvData[0])
  const suggestions: Record<string, string[]> = {}
  
  const patterns = {
    id: /^(id|ID|product_id|stt|số.*thứ.*tự)$/i,
    websiteId: /website.*id|site.*id|external.*id|web.*id/i,
    title: /^(title|name|tên|tênsảnphẩm|product.*name|post.*title)$/i,
    price: /^(price|giá|gia|regular.*price|giá.*thường)$/i,
    promotionalPrice: /^(sale.*price|promotional.*price|giá.*km|giá.*khuyến.*mãi|discount.*price)$/i,
    category: /^(category|categories|danh.*mục|phân.*loại)$/i,
    sku: /^(sku|SKU|mã.*sp|product.*code|mã.*sản.*phẩm)$/i,
    imageUrl: /^(image|image_url|hình.*ảnh|thumbnail|photo)$/i,
    externalUrl: /^(url|link|external.*url|product.*url)$/i,
    linkShopee: /^(link.*shopee|shopee.*link)$/i,
    giaShopee: /^(gia.*shopee|giá.*shopee|shopee.*price)$/i,
    linkTiktok: /^(link.*tiktok|tiktok.*link)$/i,
    giaTiktok: /^(gia.*tiktok|giá.*tiktok|tiktok.*price)$/i,
    linkLazada: /^(link.*lazada|lazada.*link)$/i,
    giaLazada: /^(gia.*lazada|giá.*lazada|lazada.*price)$/i,
    linkDmx: /^(link.*dmx|dmx.*link)$/i,
    giaDmx: /^(gia.*dmx|giá.*dmx|dmx.*price)$/i,
    linkTiki: /^(link.*tiki|tiki.*link)$/i,
    giaTiki: /^(gia.*tiki|giá.*tiki|tiki.*price)$/i
  }
  
  Object.entries(patterns).forEach(([field, pattern]) => {
    suggestions[field] = availableColumns.filter(col => pattern.test(col))
  })
  
  return suggestions
}