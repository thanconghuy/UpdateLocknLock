export type CSVRow = Record<string, string>

export type ProductData = {
  id: string
  project_id?: number
  website_id?: string
  title?: string
  price?: number
  promotional_price?: number
  external_url?: string
  category?: string
  image_url?: string
  sku?: string
  het_hang?: boolean
  // Platform data
  link_shopee?: string
  gia_shopee?: number
  link_tiktok?: string
  gia_tiktok?: number
  link_lazada?: string
  gia_lazada?: number
  link_dmx?: string
  gia_dmx?: number
  link_tiki?: string
  gia_tiki?: number
  // Timestamps
  created_at?: string
  updated_at?: string
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
  timestamp: string
  error?: string
  operation?: 'update' | 'sync'
}
