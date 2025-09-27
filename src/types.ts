export interface ProductData {
  id: string
  websiteId: string
  title: string
  price: number
  promotionalPrice?: number | null
  sku: string
  category?: string
  imageUrl?: string
  externalUrl?: string
  currency?: string

  // Stock status
  hetHang?: boolean // Out of stock status
  soLuongTon?: number | null // Stock quantity

  // Platform-specific data
  linkShopee?: string
  giaShopee?: number | null
  linkTiktok?: string
  giaTiktok?: number | null
  linkLazada?: string
  giaLazada?: number | null
  linkDmx?: string
  giaDmx?: number | null
  linkTiki?: string
  giaTiki?: number | null

  // Metadata
  createdAt?: string
  updatedAt?: string
}

export interface UpdateLog {
  id: string
  productId: string
  websiteId?: string
  title?: string
  status: 'success' | 'failed'
  timestamp: string
  error?: string
  operation?: 'update' | 'sync'
}

export interface ValidationWarning {
  id: string
  rowId: number
  field: string
  message: string
  value?: string
}

export interface CSVRow {
  [key: string]: string
}

export interface SupabaseConfig {
  url: string
  key: string
}

export interface ValidationError {
  id: string
  rowId: string
  field: string
  message: string
}

export interface ImportResult {
  success: boolean
  totalRows: number
  validRows: number
  errors: ValidationError[]
  data: ProductData[]
}

export interface SyncResult {
  success: boolean
  message: string
  stats: {
    total: number
    newProducts: number
    updated: number
    errors: number
  }
}