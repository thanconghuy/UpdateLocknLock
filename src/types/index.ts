export type CSVRow = Record<string, string>

export type ProductData = {
  id: string
  websiteId?: string
  title?: string
  price?: number
  promotionalPrice?: number
  externalUrl?: string
  category?: string
  imageUrl?: string
  sku?: string
  // Platform data
  linkShopee?: string
  giaShopee?: number
  linkTiktok?: string
  giaTiktok?: number
  linkLazada?: string
  giaLazada?: number
  linkDmx?: string
  giaDmx?: number
  linkTiki?: string
  giaTiki?: number
}

export type ValidationError = {
  id: string
  rowId: string
  field: string
  message: string
}

export type ValidationWarning = {
  id: string
  rowId: string
  field: string
  message: string
}

export type SupabaseConfig = {
  url: string
  key: string
}

export type UpdateLog = {
  id: string
  productId: string
  websiteId?: string
  title?: string
  status: 'success' | 'failed'
  timestamp: Date
  error?: string
  operation?: 'update' | 'sync'
}
