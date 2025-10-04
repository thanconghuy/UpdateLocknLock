import React, { useMemo, useState, useEffect } from 'react'
import type { ProductData } from '../types'
import { supabase } from '../lib/supabase'
import { applyAutoUpdateIfNeeded, shouldAutoUpdatePrice } from '../utils/priceAutoUpdater'
import { useStore } from '../store/useStore'
import ProductManagementCenter from './ProductManagementCenter'
import { useSettingsService } from '../services/settingsService'
import { useProject } from '../contexts/ProjectContext'
import { ENV } from '../config/env'
import NoActiveProjectBanner from './project/NoActiveProjectBanner'

interface Props {
  data?: ProductData[]
  refreshKey?: number
  onSyncComplete?: () => void
  onReloadProducts?: () => void
}

const ALL_FIELDS = [
  'title', 'website_id', 'sku', 'price', 'promotional_price',
  'image_url',
  'shopee', 'tiktok', 'lazada', 'dmx', 'tiki', // Combined brand columns
  'external_url', 'currency', 'het_hang'
]

// Platform fields that should be excluded from additional fields section
const PLATFORM_FIELDS = [
  'link_shopee', 'gia_shopee', 'shopee_link', 'shopee_price',
  'link_tiktok', 'gia_tiktok', 'tiktok_link', 'tiktok_price',
  'link_lazada', 'gia_lazada', 'lazada_link', 'lazada_price',
  'link_dmx', 'gia_dmx', 'dmx_link', 'dmx_price',
  'link_tiki', 'gia_tiki', 'tiki_link', 'tiki_price'
]

// Helper function to determine stock status from het_hang value
function getStockStatus(hetHangValue: any) {
  const isOutOfStock =
    hetHangValue === true ||
    hetHangValue === 'true' ||
    hetHangValue === 'Hết hàng' ||
    hetHangValue === 'hết hàng' ||
    hetHangValue === 1

  const isInStock =
    hetHangValue === false ||
    hetHangValue === 'false' ||
    hetHangValue === 'Còn hàng' ||
    hetHangValue === 'còn hàng' ||
    hetHangValue === 0

  return { isOutOfStock, isInStock }
}

export default function ProductsPage({ data, refreshKey, onSyncComplete, onReloadProducts }: Props) {
  const { updateProductInWooCommerce, syncProductFromWooCommerce, clearStoreForProjectSwitch } = useStore()
  const settingsService = useSettingsService()
  const { currentProject, loading: projectLoading, setShowProjectSelector } = useProject()
  const [visibleFields, setVisibleFields] = useState<string[]>(ALL_FIELDS.filter(f => f !== 'updated_at'))
  const [filter, setFilter] = useState<{ platform?: string, recentlyUpdated?: boolean, timeFilter?: string, stockStatus?: 'instock' | 'outofstock', syncStatus?: string }>({})
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Helper function for reloading products
  const handleReloadProducts = () => {
    if (onReloadProducts) {
      onReloadProducts()
    } else {
      // Fallback: refresh database data
      console.log('🔄 Manual reload requested')
      setHasInitialized(false) // Reset to trigger fresh fetch
      setDbStatus('🔄 Refreshing data...')
    }
  }

  // Helper function to get database config from admin settings or fallback
  const getDatabaseConfig = async () => {
    try {
      console.log('🔍 Loading database config from admin settings...')

      // Add timeout protection for settingsService call
      const configPromise = settingsService.getDatabaseConfig()
      const quickTimeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('SettingsService timeout - using fallback')), 3000)
      )

      const adminConfig = await Promise.race([configPromise, quickTimeoutPromise])

      if (adminConfig && adminConfig.supabase_url && adminConfig.supabase_anon_key) {
        console.log('✅ Using admin settings config')

        // 🔧 Always use products_new for consistency and project isolation
        const tableName = 'products_new'
        console.log(`📋 Using table: ${tableName} (${currentProject ? 'project-specific' : 'default'})`)

        return {
          url: adminConfig.supabase_url,
          key: adminConfig.supabase_anon_key,
          table: tableName
        }
      } else if (adminConfig === null) {
        console.log('ℹ️ No admin config found (user not authenticated or no config), using fallback')
      } else {
        console.log('⚠️ Admin config incomplete, using fallback')
      }
    } catch (error: any) {
      console.warn('❌ SettingsService failed (timeout or error), using fallback:', error?.message || error)
    }

    // Always use products_new for consistency and project isolation
    const fallbackTableName = 'products_new'
    console.log(`📋 Fallback using table: ${fallbackTableName} (${currentProject ? 'project-specific' : 'global fallback'})`)

    const fallbackConfig = {
      url: localStorage.getItem('supabase:url') || ENV.SUPABASE_URL,
      key: localStorage.getItem('supabase:key') || ENV.SUPABASE_ANON_KEY,
      table: fallbackTableName
    }

    console.log('🔄 Using fallback config:', {
      hasUrl: !!fallbackConfig.url,
      hasKey: !!fallbackConfig.key,
      table: fallbackConfig.table
    })

    return fallbackConfig
  }

  // Test database connection function
  const testDatabaseConnection = async () => {
    try {
      console.log('🧪 Testing database connection...')
      const { url, key, table } = await getDatabaseConfig()

      if (!url || !key) {
        console.error('❌ Missing database credentials for test')
        return false
      }

      // Use centralized supabase client instead of creating new instance
      // Simple connectivity test
      const { error } = await supabase
        .from(table)
        .select('count', { count: 'exact', head: true })
        .limit(1)

      if (error) {
        console.error('❌ Database connection test failed:', error.message)
        return false
      }

      console.log('✅ Database connection test successful')
      return true
    } catch (error) {
      console.error('❌ Database connection test exception:', error)
      return false
    }
  }
  const [dbRows, setDbRows] = useState<any[] | null>(null)
  const [loadingDb, setLoadingDb] = useState(false)
  const [dbStatus, setDbStatus] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [editedProduct, setEditedProduct] = useState<any | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [priceAutoUpdated, setPriceAutoUpdated] = useState(false)
  const [autoUpdateSummary, setAutoUpdateSummary] = useState<string>('')
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())
  const [syncingProducts, setSyncingProducts] = useState<Set<string>>(new Set())


  const platforms = useMemo(() => {
    const stats: Record<string, number> = {
      shopee: 0, tiktok: 0, lazada: 0, dmx: 0, tiki: 0,
      instock: 0, outofstock: 0,
      total: 0
    }

    if (dbRows) {
      dbRows.forEach((d) => {
        stats.total++

        // Platform link analysis
        const platformData = [
          { name: 'shopee', link: d.link_shopee },
          { name: 'tiktok', link: d.link_tiktok },
          { name: 'lazada', link: d.link_lazada },
          { name: 'dmx', link: d.link_dmx },
          { name: 'tiki', link: d.link_tiki }
        ]

        platformData.forEach(({ name, link }) => {
          const hasValidLink = link && link.trim() && link.length > 10
          if (hasValidLink) {
            stats[name]++
          }
        })

        // Stock status counts - handle different data types
        const { isOutOfStock } = getStockStatus(d.het_hang)
        if (isOutOfStock) {
          stats.outofstock++
        } else {
          stats.instock++
        }
      })
    }
    return stats
  }, [dbRows])

  const filteredRows = useMemo(() => {
    const base = dbRows || []

    if (!base) return []

    let filtered = base

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((d) => {
        return (
          (d.title && d.title.toLowerCase().includes(query)) ||
          (d.sku && d.sku.toLowerCase().includes(query)) ||
          (d.website_id && d.website_id.toString().includes(query)) ||
          (d.link_shopee && d.link_shopee.toLowerCase().includes(query)) ||
          (d.link_tiktok && d.link_tiktok.toLowerCase().includes(query)) ||
          (d.link_lazada && d.link_lazada.toLowerCase().includes(query)) ||
          (d.link_dmx && d.link_dmx.toLowerCase().includes(query)) ||
          (d.link_tiki && d.link_tiki.toLowerCase().includes(query))
        )
      })
    }

    // Filter by platform
    if (filter.platform) {
      filtered = filtered.filter((d) => {
        switch(filter.platform) {
          case 'shopee': return !!(d.link_shopee)
          case 'tiktok': return !!(d.link_tiktok)
          case 'lazada': return !!(d.link_lazada)
          case 'dmx': return !!(d.link_dmx)
          case 'tiki': return !!(d.link_tiki)
          default: return true
        }
      })
    }

    // Filter by stock status
    if (filter.stockStatus) {
      filtered = filtered.filter((d) => {
        switch(filter.stockStatus) {
          case 'instock': {
            const { isOutOfStock } = getStockStatus(d.het_hang)
            return !isOutOfStock
          }
          case 'outofstock': {
            const { isOutOfStock } = getStockStatus(d.het_hang)
            return isOutOfStock
          }
          default: return true
        }
      })
    }

    // Filter by sync status
    if (filter.syncStatus) {
      filtered = filtered.filter((d) => {
        const platformData = [
          { link: d.link_shopee, price: d.gia_shopee },
          { link: d.link_tiktok, price: d.gia_tiktok },
          { link: d.link_lazada, price: d.gia_lazada },
          { link: d.link_dmx, price: d.gia_dmx },
          { link: d.link_tiki, price: d.gia_tiki }
        ]

        let platformCount = 0
        let priceCount = 0
        let linkMismatch = false

        platformData.forEach(({ link, price }) => {
          const hasValidLink = link && link.trim() && link.length > 10
          const hasValidPrice = price && price > 0

          if (hasValidLink) {
            platformCount++
            if (!hasValidPrice) {
              linkMismatch = true
            }
          }
          if (hasValidPrice) {
            priceCount++
          }
        })

        switch(filter.syncStatus) {
          case 'unsynchronized':
            return platformCount === 0
          case 'partialSync':
            return platformCount > 0 && (linkMismatch || platformCount !== priceCount)
          case 'fullSync':
            return platformCount > 0 && platformCount === priceCount && !linkMismatch
          case 'missingImages':
            return !d.image_url || !d.image_url.trim()
          default:
            return true
        }
      })
    }

    // Filter by time-based filters
    if (filter.timeFilter) {
      const now = new Date()
      filtered = filtered.filter((d) => {
        switch(filter.timeFilter) {
          case 'recent-7d': {
            const sevenDaysAgo = new Date()
            sevenDaysAgo.setDate(now.getDate() - 7)
            if (recentlyUpdated.has(String(d.id))) return true
            return d.updated_at && new Date(d.updated_at) > sevenDaysAgo
          }
          case 'recent-30d': {
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(now.getDate() - 30)
            if (recentlyUpdated.has(String(d.id))) return true
            return d.updated_at && new Date(d.updated_at) > thirtyDaysAgo
          }
          case 'no-updates': {
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(now.getDate() - 30)
            if (recentlyUpdated.has(String(d.id))) return false
            return !d.updated_at || new Date(d.updated_at) < thirtyDaysAgo
          }
          default: return true
        }
      })
    }

    // Filter by recently updated (legacy support)
    if (filter.recentlyUpdated) {
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      
      filtered = filtered.filter((d) => {
        if (recentlyUpdated.has(String(d.id))) return true
        if (d.updated_at) {
          const updateDate = new Date(d.updated_at)
          return updateDate > oneDayAgo
        }
        return false
      })
    }

    return filtered
  }, [filter, searchQuery, dbRows, recentlyUpdated])

  const totalPages = Math.ceil(filteredRows.length / pageSize)
  const rows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredRows.slice(start, end)
  }, [filteredRows, currentPage, pageSize])

  function toggleField(f: string) {
    setVisibleFields((s) => s.includes(f) ? s.filter(x => x !== f) : [...s, f])
  }

  async function fetchFromDb() {
    console.log('🔄 FETCH FROM DATABASE STARTED')
    console.log('='.repeat(60))
    console.log('⏰ ' + new Date().toLocaleString('vi-VN'))
    console.log('🔧 Tool: UpdateLocknLock Complete Data Loading')
    console.log('📍 Current project:', currentProject?.name || 'No project')

    setLoadingDb(true)
    setDbStatus('🔄 Đang kết nối với database...')

    try {
      // Add timeout protection for database config loading (reduced to match SettingsService)
      const configPromise = getDatabaseConfig()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database config loading timed out after 6 seconds')), 6000)
      )

      const { url, key, table } = await Promise.race([configPromise, timeoutPromise]) as { url: string, key: string, table: string }

      console.log('🗃️ Database config loaded:')
      console.log('- URL:', url ? `${url.substring(0, 30)}...` : 'Not found')
      console.log('- Key:', key ? `${key.substring(0, 20)}...` : 'Not found')
      console.log('- Table:', table || 'Not specified')

      if (!url || !key) {
        const errorMsg = 'No database credentials found. Please configure in Admin Settings or check environment variables.'
        setDbStatus(`❌ ${errorMsg}`)
        console.error('❌ Missing credentials')
        console.error('❌ URL exists:', !!url)
        console.error('❌ Key exists:', !!key)
        setLoadingDb(false)
        return
      }

      if (!table) {
        setDbStatus('❌ No products table specified. Please configure table name in Admin Settings.')
        console.error('❌ No table name specified')
        setLoadingDb(false)
        return
      }

      setDbStatus('🔗 Connecting to database...')
      // Use centralized supabase client instead of creating new instance

      console.log('📊 Fetching complete product data...')
      setDbStatus('📊 Loading all product data...')

      // Enhanced query with timeout protection
      console.log('🔍 Using safe query with timeout protection...')

      // Add project isolation for multi-tenant data
      const queryPromise = currentProject
        ? supabase
            .from(table)
            .select('*', { count: 'exact' })
            .eq('project_id', currentProject.project_id)
            .order('updated_at', { ascending: false })
            .limit(500) // Reduced limit for better performance (was 2000)
        : supabase
            .from(table)
            .select('*', { count: 'exact' })
            .order('updated_at', { ascending: false })
            .limit(500) // Reduced limit for better performance

      const queryTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Database query timed out after 60 seconds')), 60000) // Increased to 60s
      )

      const { data: d, error, count } = await Promise.race([queryPromise, queryTimeoutPromise]) as any

      if (error) {
        console.error('❌ Database query error:', error)
        console.error('Error details:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })

        // Provide specific guidance for common errors
        let errorGuidance = ''
        if (error.message.includes('does not exist')) {
          errorGuidance = '\n💡 Lỗi cột không tồn tại - Tool sẽ sử dụng query đơn giản hơn'
          console.log('🔄 Attempting fallback query without specific columns...')

          // Try fallback query with just basic selection
          try {
            const fallbackResult = await supabase
              .from(table)
              .select('*')
              .limit(100)

            if (!fallbackResult.error && fallbackResult.data) {
              console.log('✅ Fallback query successful!')
              console.log('Available columns:', Object.keys(fallbackResult.data[0] || {}))
              setDbRows(fallbackResult.data)
              setDbStatus(`⚠️ Loaded ${fallbackResult.data.length} products (fallback mode)`)
              return
            }
          } catch (fallbackError) {
            console.error('❌ Fallback query also failed:', fallbackError)
          }
        }

        const errorMsg = `db error: ${error.message}${errorGuidance}`
        setDbStatus(`❌ ${errorMsg}`)
        setDbRows([])
        return
      }

      console.log('✅ Data loaded successfully!')
      console.log('📊 Results summary:')
      console.log(`- Total rows: ${d?.length ?? 0}`)
      console.log(`- Database count: ${count ?? 'unknown'}`)

      if (d && d.length > 0) {
        // Analyze data completeness
        const sampleProduct = d[0]
        const availableFields = Object.keys(sampleProduct)
        console.log('🔍 Available fields:', availableFields.length)
        console.log('📝 Field list:', availableFields.join(', '))

        // Platform data analysis with safe field access
        const platformStats = {
          shopee: d.filter((p: any) => p.link_shopee).length,
          tiktok: d.filter((p: any) => p.link_tiktok).length,
          tiki: d.filter((p: any) => p.link_tiki).length,
          lazada: d.filter((p: any) => p.link_lazada).length,
          dmx: d.filter((p: any) => p.link_dmx).length,
          withImages: d.filter((p: any) => p.image_url).length,
          withDescriptions: d.filter((p: any) => p.description || p.desc || p.product_description).length,
          withCategories: d.filter((p: any) => p.category || p.categories).length,
          inStock: d.filter((p: any) => !p.het_hang).length,
          outOfStock: d.filter((p: any) => p.het_hang).length
        }

        console.log('🛒 Platform link distribution:')
        console.log(`- Shopee: ${platformStats.shopee} products`)
        console.log(`- TikTok: ${platformStats.tiktok} products`)
        console.log(`- Tiki: ${platformStats.tiki} products`)
        console.log(`- Lazada: ${platformStats.lazada} products`)
        console.log(`- DMX: ${platformStats.dmx} products`)

        console.log('📊 Data completeness:')
        console.log(`- With images: ${platformStats.withImages} (${((platformStats.withImages / d.length) * 100).toFixed(1)}%)`)
        console.log(`- With descriptions: ${platformStats.withDescriptions} (${((platformStats.withDescriptions / d.length) * 100).toFixed(1)}%)`)
        console.log(`- With categories: ${platformStats.withCategories} (${((platformStats.withCategories / d.length) * 100).toFixed(1)}%)`)

        console.log('📦 Stock status:')
        console.log(`- In stock: ${platformStats.inStock} products`)
        console.log(`- Out of stock: ${platformStats.outOfStock} products`)
      }

      const loadedCount = d?.length ?? 0
      console.log('🔄 Setting dbRows with loaded data:', {
        loadedCount,
        dataExists: !!d,
        firstProduct: d?.[0] ? {
          id: d[0].id,
          website_id: d[0].website_id,
          title: d[0].title,
          updated_at: d[0].updated_at
        } : null
      })
      setDbRows(d || [])

      // Data quality assessment
      let qualityNote = ''
      if (d && d.length > 0) {
        const withPlatformLinks = d.filter((p: any) => p.link_shopee || p.link_tiktok || p.link_tiki || p.link_lazada || p.link_dmx).length
        const linkCoverage = (withPlatformLinks / d.length) * 100
        const withImages = d.filter((p: any) => p.image_url).length
        const imageCoverage = (withImages / d.length) * 100

        if (linkCoverage < 50) {
          qualityNote = ` (⚠️ ${linkCoverage.toFixed(0)}% có platform links)`
        } else if (imageCoverage < 30) {
          qualityNote = ` (⚠️ ${imageCoverage.toFixed(0)}% có hình ảnh)`
        } else {
          qualityNote = ` (✨ Dữ liệu đầy đủ)`
        }
      }

      setDbStatus(`✅ Loaded ${loadedCount} products with complete data${qualityNote}`)
      setHasInitialized(true) // Mark as initialized

      console.log('🎉 Data loading completed successfully!')
      console.log('='.repeat(60))

    } catch (err: any) {
      console.error('❌ FETCH FROM DATABASE FAILED:', err)
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        stack: err?.stack?.substring(0, 200)
      })

      const errorMsg = `fetch error: ${err?.message ?? String(err)}`
      setDbStatus(`❌ ${errorMsg}`)
      setDbRows([])

      console.log('💡 Troubleshooting suggestions:')
      console.log('- Check internet connection')
      console.log('- Verify Supabase credentials')
      console.log('- Ensure table exists and has correct permissions')
      console.log('- Check if API quota is exceeded')

    } finally {
      setLoadingDb(false)
      setHasInitialized(true) // Always mark as initialized, even on error
      console.log('🏁 Database fetch process completed')
    }
  }


  // Auto-load data on mount (only once) - wait for project to be ready
  useEffect(() => {
    // Only fetch when:
    // 1. Not initialized yet
    // 2. Not currently loading
    // 3. Project context is ready (not loading)
    // 4. Have a current project
    if (!hasInitialized && !loadingDb && !projectLoading && currentProject) {
      console.log('🚀 ProductsPage: Conditions met - fetching data from database')
      console.log('📍 Current project:', currentProject.name)
      fetchFromDb()
    } else {
      const reasons = []
      if (hasInitialized) reasons.push('already initialized')
      if (loadingDb) reasons.push('db loading')
      if (projectLoading) reasons.push('project loading')
      if (!currentProject) reasons.push('no project')

      if (reasons.length > 0) {
        console.log('⏳ ProductsPage: Waiting to fetch data -', reasons.join(', '))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInitialized, loadingDb, projectLoading, currentProject])

  // 🔄 IMPORTANT: Reset and reload data when currentProject changes (project switching)
  useEffect(() => {
    if (currentProject && !projectLoading) {
      console.log('🔄 ProductsPage: Current project changed, resetting data and reloading...')
      console.log('📍 New project:', currentProject.name)
      console.log('📋 New products table:', currentProject.products_table)

      // 🧹 Clear Zustand store to prevent data contamination between projects
      clearStoreForProjectSwitch()

      // Reset component state to trigger fresh fetch from the new project's table
      setDbRows([])
      setDbStatus('🔄 Switching project - loading data...')
      setHasInitialized(false) // Reset to trigger fresh fetch
      // fetchFromDb will be called by the first useEffect when hasInitialized becomes false
    }
  }, [currentProject?.id, currentProject?.products_table, clearStoreForProjectSwitch]) // Track project ID and table changes

  // Refresh data when refreshKey changes (after sync operations)
  useEffect(() => {
    if (refreshKey && refreshKey > 0) {
      console.log('🔄 refreshKey changed to:', refreshKey, '- clearing current data and fetching fresh from DB')
      // Clear current data and reset initialization flag
      setDbRows([])
      setDbStatus('🔄 Refreshing data after sync...')
      setHasInitialized(false) // Reset to trigger fresh fetch
      // fetchFromDb will be called by the first useEffect when hasInitialized becomes false
    }
  }, [refreshKey])

  // Debug logging when dbRows changes
  useEffect(() => {
    console.log('🔄 dbRows state changed:', {
      hasData: !!dbRows,
      count: dbRows?.length || 0,
      firstItem: dbRows?.[0] ? {
        id: dbRows[0].id,
        website_id: dbRows[0].website_id,
        title: dbRows[0].title
      } : null
    })
  }, [dbRows])

  function openEditSidebar(product: any) {
    console.log('Opening edit sidebar for product:', product)
    if (!product) {
      console.error('No product provided to openEditSidebar')
      return
    }
    
    setSelectedProduct(product)
    
    // Check if auto-update is needed and apply it
    const autoUpdateResult = applyAutoUpdateIfNeeded(product)
    let updatedProduct = autoUpdateResult.wasUpdated ? autoUpdateResult.updatedProduct : { ...product }
    
    // Auto-update promotional price to lowest platform price and set external URL
    const platformData = [
      { name: 'Shopee', price: updatedProduct.gia_shopee || 0, link: updatedProduct.link_shopee || '' },
      { name: 'TikTok', price: updatedProduct.gia_tiktok || 0, link: updatedProduct.link_tiktok || '' },
      { name: 'Lazada', price: updatedProduct.gia_lazada || 0, link: updatedProduct.link_lazada || '' },
      { name: 'Điện máy xanh', price: updatedProduct.gia_dmx || 0, link: updatedProduct.link_dmx || '' },
      { name: 'Tiki', price: updatedProduct.gia_tiki || 0, link: updatedProduct.link_tiki || '' }
    ].filter(platform => platform.price > 0 && platform.link)
    
    let promotionalPriceUpdated = false
    let promotionalPriceSummary = ''
    
    if (platformData.length > 0) {
      // Find platform with lowest price
      const lowestPricePlatform = platformData.reduce((prev, current) => 
        (prev.price < current.price) ? prev : current
      )
      
      const needsPriceUpdate = updatedProduct.promotional_price !== lowestPricePlatform.price
      const needsUrlUpdate = updatedProduct.external_url !== lowestPricePlatform.link
      
      if (needsPriceUpdate || needsUrlUpdate) {
        const oldPrice = updatedProduct.promotional_price || 0
        const oldUrl = updatedProduct.external_url || ''
        
        updatedProduct.promotional_price = lowestPricePlatform.price
        updatedProduct.external_url = lowestPricePlatform.link
        promotionalPriceUpdated = true
        
        let summary = []
        if (needsPriceUpdate) {
          summary.push(`Giá khuyến mãi: ${oldPrice.toLocaleString('vi-VN')}₫ → ${lowestPricePlatform.price.toLocaleString('vi-VN')}₫`)
        }
        if (needsUrlUpdate) {
          summary.push(`Link ngoài: ${lowestPricePlatform.name}`)
        }
        promotionalPriceSummary = `Tự động cập nhật từ ${lowestPricePlatform.name}:\n${summary.join('\n')}`
      }
    }
    
    if (autoUpdateResult.wasUpdated || promotionalPriceUpdated) {
      setEditedProduct(updatedProduct)
      let combinedSummary = ''
      if (autoUpdateResult.wasUpdated) {
        combinedSummary += autoUpdateResult.updateSummary
      }
      if (promotionalPriceUpdated) {
        if (combinedSummary) combinedSummary += '\n\n'
        combinedSummary += promotionalPriceSummary
      }
      setAutoUpdateSummary(combinedSummary)
      setPriceAutoUpdated(true)
      
      // Auto-hide the summary after 10 seconds
      setTimeout(() => {
        setPriceAutoUpdated(false)
        setAutoUpdateSummary('')
      }, 10000)
    } else {
      setEditedProduct(updatedProduct)
      setAutoUpdateSummary('')
      setPriceAutoUpdated(false)
    }
  }

  function closeEditSidebar() {
    setSelectedProduct(null)
    setEditedProduct(null)
  }

  function handleFieldChange(field: string, value: any) {
    setEditedProduct((prev: any) => {
      const updated = {
        ...prev,
        [field]: value
      }

      // Auto-update promotional price and external URL when platform prices change
      if (field.startsWith('gia_') || field.startsWith('link_')) {
        const platformData = [
          { name: 'Shopee', price: updated.gia_shopee || 0, link: updated.link_shopee || '' },
          { name: 'TikTok', price: updated.gia_tiktok || 0, link: updated.link_tiktok || '' },
          { name: 'Lazada', price: updated.gia_lazada || 0, link: updated.link_lazada || '' },
          { name: 'Điện máy xanh', price: updated.gia_dmx || 0, link: updated.link_dmx || '' },
          { name: 'Tiki', price: updated.gia_tiki || 0, link: updated.link_tiki || '' }
        ].filter(platform => platform.price > 0 && platform.link)

        if (platformData.length > 0) {
          // Find platform with lowest price
          const lowestPricePlatform = platformData.reduce((prev, current) => 
            (prev.price < current.price) ? prev : current
          )
          
          updated.promotional_price = lowestPricePlatform.price
          updated.external_url = lowestPricePlatform.link
          setPriceAutoUpdated(true)
          setTimeout(() => setPriceAutoUpdated(false), 2000)
          console.log(`Auto-updating promotional price and external URL from ${lowestPricePlatform.name}: ${lowestPricePlatform.price}`)
        }
      }

      return updated
    })
  }

  function hasChanges(): boolean {
    if (!selectedProduct || !editedProduct) return false
    return JSON.stringify(selectedProduct) !== JSON.stringify(editedProduct)
  }

  function isFieldChanged(field: string): boolean {
    if (!selectedProduct || !editedProduct) return false
    
    // For platform fields, check both link and price sub-fields
    if (['shopee', 'tiktok', 'lazada', 'dmx', 'tiki'].includes(field)) {
      const linkField = `link_${field}`
      const priceField = `gia_${field}`
      return (
        selectedProduct[linkField] !== editedProduct[linkField] ||
        selectedProduct[priceField] !== editedProduct[priceField]
      )
    }
    
    return selectedProduct[field] !== editedProduct[field]
  }

  async function updateProduct() {
    if (!editedProduct || !hasChanges()) {
      console.log('No changes to update or no edited product')
      return
    }

    console.log('Updating product:', editedProduct)
    setIsUpdating(true)
    let dbUpdateSuccess = false
    
    try {
      const { url, key, table } = await getDatabaseConfig()

      if (!url || !key) {
        setDbStatus('No database credentials found. Please configure in Admin Settings.')
        setIsUpdating(false)
        return
      }

      if (!editedProduct.id) {
        setDbStatus('Product ID is missing')
        setIsUpdating(false)
        return
      }

      // Use centralized supabase client instead of creating new instance
      console.log('Sending update to Supabase:', { table, id: editedProduct.id, data: editedProduct })

      // First, verify the product exists with project isolation
      const existenceQuery = currentProject
        ? supabase
            .from(table)
            .select('id, sku')
            .eq('id', editedProduct.id)
            .eq('project_id', currentProject.project_id)
            .single()
        : supabase
            .from(table)
            .select('id, sku')
            .eq('id', editedProduct.id)
            .single()

      const { data: existingProduct, error: checkError } = await existenceQuery
      
      console.log('Product existence check:', { existingProduct, checkError })
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found"
        setDbStatus(`Error checking product existence: ${checkError.message}`)
        setIsUpdating(false)
        return
      }
      
      if (!existingProduct) {
        setDbStatus(`Product with ID ${editedProduct.id} not found in database`)
        console.error('Product not found:', editedProduct.id)
        setIsUpdating(false)
        return
      }
      
      // Prepare update data (exclude read-only fields)
      const updateData = { ...editedProduct }
      delete updateData.id // Don't update the ID
      delete updateData.created_at // Don't update created_at
      updateData.updated_at = new Date().toISOString()

      console.log('Update data being sent:', updateData)

      // Update the product with project isolation
      const updateQuery = currentProject
        ? supabase
            .from(table)
            .update(updateData)
            .eq('id', editedProduct.id)
            .eq('project_id', currentProject.project_id)
            .select()
        : supabase
            .from(table)
            .update(updateData)
            .eq('id', editedProduct.id)
            .select()

      const { error, data: updateResult } = await updateQuery

      console.log('Update result:', { error, updateResult })

      if (error) {
        setDbStatus(`Update error: ${error.message}`)
        console.error('Update error:', error)
        return
      } else {
        console.log('Product updated successfully:', updateResult)
        dbUpdateSuccess = true
        
        // Verify update by checking if any rows were affected
        if (!updateResult || updateResult.length === 0) {
          setDbStatus('Warning: Update executed but no rows were affected. Check if product ID exists.')
          console.warn('Update completed but no rows were affected:', editedProduct.id)
        }
        
        // Add audit log entry (if enabled)
        const auditLogTable = localStorage.getItem('supabase:audit_table') || 'product_updates'
        const auditEnabled = localStorage.getItem('supabase:audit_enabled') !== 'false'
        
        // Create audit entry - compatible with existing table structure
        const auditEntry: any = {
          product_sku: editedProduct.sku || 'unknown',
          changes: JSON.stringify({
            id: editedProduct.id,
            old: selectedProduct,
            new: editedProduct,
            changed_fields: Object.keys(editedProduct).filter(key => 
              selectedProduct[key] !== editedProduct[key]
            )
          }),
          updated_at: new Date().toISOString(),
          updated_by: 'manual_edit',
          source: 'ui'
        }

        // Only add product_id if it's a valid integer to avoid UUID conflicts
        const productIdAsNumber = parseInt(String(editedProduct.id))
        if (!isNaN(productIdAsNumber) && String(productIdAsNumber) === String(editedProduct.id)) {
          auditEntry.product_id = productIdAsNumber
        }

        if (auditEnabled) {
          try {
            console.log('Attempting to create audit log entry:', auditEntry)
          const { error: auditError } = await supabase
            .from(auditLogTable)
            .insert([auditEntry])

          if (auditError) {
            console.warn('Audit log failed:', auditError)
            // Check if it's a column/table structure issue
            if (auditError.message.includes('column') || auditError.message.includes('relation')) {
              setDbStatus(`✅ Database updated! ⚠️ Audit table schema mismatch`)
            } else {
              setDbStatus(`✅ Database updated! ⚠️ Audit log error: ${auditError.message}`)
            }
          } else {
            setDbStatus('✅ Database updated with audit log!')
            console.log('Audit log created successfully:', auditEntry)
          }
          } catch (auditErr: any) {
            console.warn('Audit log exception:', auditErr)
            setDbStatus(`✅ Database updated! (audit log failed: ${auditErr?.message || 'unknown error'})`)
          }
        } else {
          setDbStatus('✅ Database updated! (audit logging disabled)')
          console.log('Audit logging is disabled')
        }

        // Update local data with the result from database
        const updatedProduct = updateResult && updateResult.length > 0 ? updateResult[0] : editedProduct
        setDbRows(prev => prev ? prev.map(p => p.id === editedProduct.id ? updatedProduct : p) : prev)
        setSelectedProduct(updatedProduct)
        
        // Track recently updated products
        setRecentlyUpdated(prev => {
          const newSet = new Set(prev)
          newSet.add(String(editedProduct.id))
          return newSet
        })
        
        // Remove from recently updated after 30 seconds
        setTimeout(() => {
          setRecentlyUpdated(prev => {
            const newSet = new Set(prev)
            newSet.delete(String(editedProduct.id))
            return newSet
          })
        }, 30000)
        
        console.log('Product updated successfully:', updatedProduct)
      }
      
      // Auto-update to WooCommerce if database update was successful
      if (dbUpdateSuccess) {
        console.log('Database update successful, now updating WooCommerce...')
        try {
          // Map the product data to match ProductData interface
          const productData: ProductData = {
            id: editedProduct.id?.toString() || '',
            websiteId: editedProduct.website_id?.toString() || '',
            title: editedProduct.title || '',
            price: editedProduct.price || 0,
            promotionalPrice: editedProduct.promotional_price || 0,
            externalUrl: editedProduct.external_url || '',
            sku: editedProduct.sku || '',
            linkShopee: editedProduct.link_shopee || '',
            giaShopee: editedProduct.gia_shopee || 0,
            linkTiktok: editedProduct.link_tiktok || '',
            giaTiktok: editedProduct.gia_tiktok || 0,
            linkLazada: editedProduct.link_lazada || '',
            giaLazada: editedProduct.gia_lazada || 0,
            linkDmx: editedProduct.link_dmx || '',
            giaDmx: editedProduct.gia_dmx || 0,
            linkTiki: editedProduct.link_tiki || '',
            giaTiki: editedProduct.gia_tiki || 0,
            hetHang: editedProduct.het_hang
          }

          if (!currentProject) {
            console.error('❌ No current project for WooCommerce update')
            setDbStatus('❌ Error: No project selected')
            setIsUpdating(false)
            return
          }

          const wooSuccess = await updateProductInWooCommerce(productData, currentProject)
          
          if (wooSuccess) {
            setDbStatus('✅ Updated database & WooCommerce successfully!')
          } else {
            setDbStatus('✅ Database updated! ⚠️ WooCommerce update failed - check logs')
          }
        } catch (wooError) {
          console.error('WooCommerce update error:', wooError)
          setDbStatus('✅ Database updated! ⚠️ WooCommerce update error')
        }
      }
      
    } catch (err: any) {
      setDbStatus(`Update failed: ${err?.message ?? String(err)}`)
      console.error('Update failed:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  async function syncProductFromWebsite(product: any) {
    if (!product?.website_id || !product?.id) {
      setDbStatus('❌ Missing website ID or product ID for sync')
      return
    }

    const productKey = String(product.id)
    setSyncingProducts(prev => new Set(prev).add(productKey))
    
    try {
      if (!currentProject) {
        console.error('❌ No current project for WooCommerce sync')
        return
      }

      const syncedData = await syncProductFromWooCommerce(product.website_id, product.id, currentProject)
      
      if (syncedData) {
        // Update local database with synced data
        const { url, key, table } = await getDatabaseConfig()

        if (url && key) {
          // Use centralized supabase client instead of creating new instance

          const updateData = {
            title: syncedData.title,
            price: syncedData.price,
            promotional_price: syncedData.promotionalPrice,
            external_url: syncedData.externalUrl,
            sku: syncedData.sku,
            link_tiktok: syncedData.linkTiktok,
            gia_tiktok: syncedData.giaTiktok,
            link_dmx: syncedData.linkDmx,
            gia_dmx: syncedData.giaDmx,
            link_lazada: syncedData.linkLazada,
            gia_lazada: syncedData.giaLazada,
            link_shopee: syncedData.linkShopee,
            gia_shopee: syncedData.giaShopee,
            link_tiki: syncedData.linkTiki,
            gia_tiki: syncedData.giaTiki,
            updated_at: new Date().toISOString()
          }
          
          // Update with project isolation
          const syncUpdateQuery = currentProject
            ? supabase
                .from(table)
                .update(updateData)
                .eq('id', product.id)
                .eq('project_id', currentProject.project_id)
            : supabase
                .from(table)
                .update(updateData)
                .eq('id', product.id)

          const { error } = await syncUpdateQuery
          
          if (!error) {
            // Update local data
            setDbRows(prev => prev ? prev.map(p => p.id === product.id ? { ...p, ...updateData } : p) : prev)
            setDbStatus(`✅ Synced product "${syncedData.title}" from website successfully!`)
            
            // Mark as recently updated
            setRecentlyUpdated(prev => {
              const newSet = new Set(prev)
              newSet.add(productKey)
              return newSet
            })
            
            setTimeout(() => {
              setRecentlyUpdated(prev => {
                const newSet = new Set(prev)
                newSet.delete(productKey)
                return newSet
              })
            }, 30000)
          } else {
            setDbStatus(`⚠️ Synced from website but failed to update database: ${error.message}`)
          }
        } else {
          setDbStatus('✅ Synced from website but no database credentials to save locally')
        }
      } else {
        setDbStatus('❌ Failed to sync product from website')
      }
    } catch (error) {
      console.error('Sync error:', error)
      setDbStatus(`❌ Sync error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSyncingProducts(prev => {
        const newSet = new Set(prev)
        newSet.delete(productKey)
        return newSet
      })
    }
  }

  // Show global loading state when project is loading
  if (projectLoading) {
    return (
      <div className="neo-card">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-lg font-medium text-gray-800 mb-2">Loading Project...</h2>
            <p className="text-gray-600">Please wait while we load your project data</p>
          </div>
        </div>
      </div>
    )
  }

  // Check if current project is invalid (deleted or inactive)
  const isProjectInvalid = currentProject && (
    !!currentProject.deleted_at || !currentProject.is_active
  )

  return (
    <div className="neo-card">
      {/* Show warning banner if no active project */}
      {(!currentProject || isProjectInvalid) && (
        <NoActiveProjectBanner
          onManageProjects={() => setShowProjectSelector(true)}
        />
      )}

      {/* Don't show main content if no valid project */}
      {!currentProject || isProjectInvalid ? (
        <div className="text-center py-12 text-gray-500">
          <p>Vui lòng chọn project hoạt động để xem danh sách sản phẩm.</p>
        </div>
      ) : (
        <>
          {/* Top row: filters and counters */}
          <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Products ({rows.length} shown / {filteredRows.length} filtered / {dbRows?.length || 0} total)</h2>
          <div className="text-sm text-gray-600">
            Tổng quan: {platforms.total} sản phẩm
          </div>
        </div>

        {/* Platform Statistics Row */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="text-sm font-medium text-gray-700 mr-2">Platform Links:</div>
          <div className="filter-pill bg-orange-100 text-orange-700 border-orange-200">
            Shopee: {platforms.shopee}
          </div>
          <div className="filter-pill bg-pink-100 text-pink-700 border-pink-200">
            TikTok: {platforms.tiktok}
          </div>
          <div className="filter-pill bg-purple-100 text-purple-700 border-purple-200">
            Tiki: {platforms.tiki}
          </div>
          <div className="filter-pill bg-blue-100 text-blue-700 border-blue-200">
            Lazada: {platforms.lazada}
          </div>
          <div className="filter-pill bg-green-100 text-green-700 border-green-200">
            DMX: {platforms.dmx}
          </div>
        </div>

        {/* Stock and Sync Status Row */}
        <div className="flex gap-2 items-center flex-wrap">
          <div className="text-sm font-medium text-gray-700 mr-2">Kho & Đồng bộ:</div>
          <div className="filter-pill bg-green-100 text-green-700 border-green-200">
            Còn hàng: {platforms.instock}
          </div>
          <div className="filter-pill bg-red-100 text-red-700 border-red-200">
            Hết hàng: {platforms.outofstock}
          </div>
          {recentlyUpdated.size > 0 && (
            <div className="filter-pill bg-blue-100 text-blue-700 border-blue-200">
              Recently updated: {recentlyUpdated.size}
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-4">
        <div className="neo-card p-3">
          <h4 className="font-medium">Filters - Visible Fields</h4>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ALL_FIELDS.map((f) => (
              <div key={f} className="field-toggle">
                <input id={`cb-${f}`} type="checkbox" checked={visibleFields.includes(f)} onChange={() => toggleField(f)} />
                <label htmlFor={`cb-${f}`} className="ml-2 text-sm">
                  {(() => {
                    const fieldLabels = {
                      'title': 'Tên sản phẩm + ID',
                      'website_id': 'Website ID',
                      'sku': 'SKU',
                      'price': 'Giá thường',
                      'promotional_price': 'Giá khuyến mãi',
                      'image_url': 'Hình ảnh',
                      'shopee': 'Shopee (Link + Giá)',
                      'tiktok': 'TikTok (Link + Giá)',
                      'lazada': 'Lazada (Link + Giá)',
                      'dmx': 'Điện máy xanh (Link + Giá)',
                      'tiki': 'Tiki (Link + Giá)',
                      'external_url': 'URL ngoài',
                      'currency': 'Tiền tệ',
                      'het_hang': 'Trạng thái kho'
                    }
                    return fieldLabels[f as keyof typeof fieldLabels] || f.replace('_', ' ')
                  })()}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="neo-card p-3">
          <h4 className="font-medium">Filters</h4>
          <div className="mt-2 space-y-2">
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Platform Filters:</div>
              <div className="flex gap-2 flex-wrap">
                <button className={`px-3 py-1 ${filter.platform === 'shopee' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'shopee' ? undefined : 'shopee' }); setCurrentPage(1) }}>Shopee</button>
                <button className={`px-3 py-1 ${filter.platform === 'tiktok' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'tiktok' ? undefined : 'tiktok' }); setCurrentPage(1) }}>TikTok</button>
                <button className={`px-3 py-1 ${filter.platform === 'tiki' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'tiki' ? undefined : 'tiki' }); setCurrentPage(1) }}>Tiki</button>
                <button className={`px-3 py-1 ${filter.platform === 'lazada' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'lazada' ? undefined : 'lazada' }); setCurrentPage(1) }}>Lazada</button>
                <button className={`px-3 py-1 ${filter.platform === 'dmx' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'dmx' ? undefined : 'dmx' }); setCurrentPage(1) }}>DMX</button>
              </div>

              <div className="text-sm font-medium text-gray-700">Stock Status Filters:</div>
              <div className="flex gap-2 flex-wrap">
                <button
                  className={`px-3 py-1 ${filter.stockStatus === 'instock' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'}`}
                  onClick={() => {
                    setFilter({ ...filter, stockStatus: filter.stockStatus === 'instock' ? undefined : 'instock' });
                    setCurrentPage(1)
                  }}
                >
                  Còn hàng ({platforms.instock})
                </button>
                <button
                  className={`px-3 py-1 ${filter.stockStatus === 'outofstock' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 border border-red-300 hover:bg-red-200'}`}
                  onClick={() => {
                    setFilter({ ...filter, stockStatus: filter.stockStatus === 'outofstock' ? undefined : 'outofstock' });
                    setCurrentPage(1)
                  }}
                >
                  Hết hàng ({platforms.outofstock})
                </button>
              </div>

            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Time Filters:</div>
              <div className="flex gap-2 flex-wrap">
                <button className={`px-2 py-1 text-xs ${filter.timeFilter === 'recent-7d' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, timeFilter: filter.timeFilter === 'recent-7d' ? undefined : 'recent-7d', recentlyUpdated: false }); setCurrentPage(1) }}>Updated in 7 days</button>
                <button className={`px-2 py-1 text-xs ${filter.timeFilter === 'recent-30d' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, timeFilter: filter.timeFilter === 'recent-30d' ? undefined : 'recent-30d', recentlyUpdated: false }); setCurrentPage(1) }}>Updated in 30 days</button>
                <button className={`px-2 py-1 text-xs ${filter.timeFilter === 'no-updates' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, timeFilter: filter.timeFilter === 'no-updates' ? undefined : 'no-updates', recentlyUpdated: false }); setCurrentPage(1) }}>No recent updates</button>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="recently-updated" 
                  checked={filter.recentlyUpdated || false}
                  onChange={(e) => { setFilter({ ...filter, recentlyUpdated: e.target.checked, timeFilter: undefined }); setCurrentPage(1) }}
                />
                <label htmlFor="recently-updated" className="text-sm text-gray-700 cursor-pointer">
                  Show only recently updated (last 24h)
                </label>
              </div>
            </div>
            {recentlyUpdated.size > 0 && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                <div className="font-medium text-green-800 mb-1">📊 Recent Activity:</div>
                <div className="text-green-700">
                  {recentlyUpdated.size} product{recentlyUpdated.size > 1 ? 's' : ''} updated in this session
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products by name, SKU, ID, or links..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1) // Reset to first page on search
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute left-3 top-2.5 text-gray-400">
                🔍
              </div>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('')
                    setCurrentPage(1)
                  }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <button className="neo-btn" onClick={() => fetchFromDb()} disabled={loadingDb}>
            {loadingDb ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Loading Complete Data...
              </span>
            ) : (
              <span className="flex items-center gap-1">
                🔄 Refresh All Data from DB
              </span>
            )}
          </button>
          <button
            className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
            onClick={testDatabaseConnection}
            disabled={loadingDb}
          >
            🧪 Test DB Connection
          </button>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {dbStatus && (
            <div className={`px-3 py-2 rounded text-sm font-medium ${
              dbStatus.includes('❌') || dbStatus.includes('error')
                ? 'bg-red-100 text-red-800 border border-red-200'
                : dbStatus.includes('⚠️') && dbStatus.includes('fallback')
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                : dbStatus.includes('🔄') || dbStatus.includes('🔗') || dbStatus.includes('📊')
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-green-100 text-green-800 border border-green-200'
            }`}>
              {dbStatus}
            </div>
          )}
          {!dbRows && !loadingDb && !dbStatus && (
            <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded text-sm border border-blue-200">
              💡 Click "🔄 Refresh All Data from DB" to load complete product data from your current project
            </div>
          )}
          {projectLoading && (
            <div className="px-3 py-2 bg-yellow-50 text-yellow-700 rounded text-sm border border-yellow-200">
              ⏳ Loading project data, please wait...
            </div>
          )}
          <div className="px-3 py-2 bg-gray-50 text-gray-700 rounded text-xs border border-gray-200">
            🔧 Debug: Project={currentProject?.name || 'None'} | ProjectLoading={projectLoading.toString()} | HasInit={hasInitialized.toString()} | DbLoading={loadingDb.toString()}
          </div>
          {dbRows && dbRows.length > 0 && !loadingDb && (
            <div className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-200">
              📊 Dataset: {dbRows.length} products loaded with full details
            </div>
          )}
          {searchQuery && (
            <div className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm border border-blue-200">
              🔍 Searching: "{searchQuery}" ({filteredRows.length} results)
            </div>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm muted">Items per page:</span>
          <select 
            value={pageSize} 
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
            className="neo-select"
          >
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            className="neo-btn" 
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="text-sm muted">
            Page {currentPage} of {totalPages} ({filteredRows.length} items)
          </span>
          <button 
            className="neo-btn"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {/* Main content: table and edit panel side by side */}
      <div className="w-full">
          <div className="overflow-auto">
            <table className="table-neo w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 border">#</th>
                  {visibleFields.map(f => (
                    <th key={f} className={`p-2 border ${['shopee', 'tiktok', 'lazada', 'dmx', 'tiki'].includes(f) ? 'min-w-32' : ''}`}>
                      {(() => {
                        const fieldLabels = {
                          'title': 'Tên sản phẩm + ID',
                          'website_id': 'Website ID',
                          'sku': 'SKU',
                          'price': 'Giá thường',
                          'promotional_price': 'Giá KM',
                          'image_url': 'Hình ảnh',
                          'shopee': 'Shopee',
                          'tiktok': 'TikTok',
                          'lazada': 'Lazada',
                          'dmx': 'Điện máy xanh',
                          'tiki': 'Tiki',
                          'external_url': 'URL ngoài',
                          'currency': 'Tiền tệ',
                          'het_hang': 'Trạng thái kho'
                        }
                        return fieldLabels[f as keyof typeof fieldLabels] || f.replace('_', ' ')
                      })()}
                    </th>
                  ))}
                  <th className="p-2 border">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleFields.length + 2} className="p-4 text-center muted">
                      {loadingDb ? 'Loading products...' : 'No products to display. Check database connection.'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => {
                const isRecentlyUpdated = recentlyUpdated.has(String(r?.id))
                const isCurrentlyEditing = selectedProduct && String(selectedProduct.id) === String(r?.id)
                const isSyncing = syncingProducts.has(String(r?.id))
                
                // Determine row styling based on status
                let rowClasses = 'border-t transition-all duration-300 '
                if (isCurrentlyEditing) {
                  rowClasses += 'bg-blue-100 border-blue-300 ring-2 ring-blue-200 shadow-lg'
                } else if (isRecentlyUpdated) {
                  rowClasses += 'bg-green-50 border-green-200'
                } else {
                  rowClasses += 'hover:bg-gray-50'
                }
                
                return (
                  <React.Fragment key={r?.id ?? (currentPage - 1) * pageSize + i + 1}>
                    <tr className={rowClasses}>
                      <td className="p-2 relative">
                        {(currentPage - 1) * pageSize + i + 1}
                      {isCurrentlyEditing && (
                        <div className="absolute -top-1 -right-1">
                          <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs bg-blue-500 text-white">
                            📝
                          </span>
                        </div>
                      )}
                      {isRecentlyUpdated && !isCurrentlyEditing && (
                        <div className="absolute -top-1 -right-1">
                          <span className="inline-flex items-center px-1 py-0.5 rounded-full text-xs bg-green-500 text-white">
                            ✨
                          </span>
                        </div>
                      )}
                    </td>
                    {visibleFields.map((f) => (
                      <td key={f} className={`p-2 ${['shopee', 'tiktok', 'lazada', 'dmx', 'tiki'].includes(f) ? 'min-w-32' : ''}`}>
                        {(() => {
                          
                          // Handle combined brand columns (shopee, tiktok, lazada, dmx, tiki)
                          if (['shopee', 'tiktok', 'lazada', 'dmx', 'tiki'].includes(f)) {
                            const linkField = `link_${f}`
                            const priceField = `gia_${f}`
                            const link = r?.[linkField] || ''
                            const price = r?.[priceField] || 0

                            // Platform-specific styling
                            const platformConfig = {
                              'shopee': { icon: '🛒', color: 'text-orange-600', bg: 'bg-orange-50', name: 'Shopee' },
                              'tiktok': { icon: '📱', color: 'text-black', bg: 'bg-gray-50', name: 'TikTok' },
                              'tiki': { icon: '🛍️', color: 'text-purple-600', bg: 'bg-purple-50', name: 'Tiki' },
                              'lazada': { icon: '🏪', color: 'text-blue-600', bg: 'bg-blue-50', name: 'Lazada' },
                              'dmx': { icon: '🔌', color: 'text-green-600', bg: 'bg-green-50', name: 'DMX' }
                            }

                            const config = platformConfig[f as keyof typeof platformConfig] || { icon: '🔗', color: 'text-blue-600', bg: 'bg-blue-50', name: f.toUpperCase() }

                            if (!link && !price) {
                              return (
                                <div className="text-xs space-y-1 min-w-0">
                                  <span className="text-gray-400 text-xs">-</span>
                                </div>
                              )
                            }

                            return (
                              <div className="text-xs space-y-1 min-w-0">
                                {link && (
                                  <div className="truncate">
                                    <a
                                      className={`inline-flex items-center gap-1 ${config.color} hover:opacity-80 hover:underline transition-all`}
                                      href={link}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={`${config.name}: ${link}`}
                                    >
                                      <span className="text-sm">{config.icon}</span>
                                      <span className="truncate text-xs font-medium">
                                        {config.name}
                                      </span>
                                    </a>
                                  </div>
                                )}
                                {price > 0 && (
                                  <div className={`font-semibold ${config.bg} px-2 py-0.5 rounded text-center text-xs border`}>
                                    <div className={`${config.color} font-bold`}>
                                      {new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price)}₫
                                    </div>
                                  </div>
                                )}
                                {link && !price && (
                                  <div className="text-yellow-600 text-xs italic bg-yellow-50 px-1 py-0.5 rounded">
                                    Thiếu giá
                                  </div>
                                )}
                                {!link && price > 0 && (
                                  <div className="text-orange-600 text-xs italic bg-orange-50 px-1 py-0.5 rounded">
                                    Thiếu link
                                  </div>
                                )}
                              </div>
                            )
                          }

                          // Handle title field (add product link and platform info)
                          if (f === 'title') {
                            const productUrl = r?.website_id ? `https://locknlockvietnam.com/shop/?p=${r.website_id}` : null

                            // Analyze sync status for platform data
                            const platformData = [
                              { link: r?.link_shopee, price: r?.gia_shopee },
                              { link: r?.link_tiktok, price: r?.gia_tiktok },
                              { link: r?.link_tiki, price: r?.gia_tiki },
                              { link: r?.link_lazada, price: r?.gia_lazada },
                              { link: r?.link_dmx, price: r?.gia_dmx }
                            ]

                            let platformCount = 0
                            let priceCount = 0
                            let linkMismatch = false

                            platformData.forEach(({ link, price }) => {
                              const hasValidLink = link && link.trim() && link.length > 10
                              const hasValidPrice = price && price > 0

                              if (hasValidLink) {
                                platformCount++
                                if (!hasValidPrice) {
                                  linkMismatch = true
                                }
                              }
                              if (hasValidPrice) {
                                priceCount++
                              }
                            })

                            // Determine sync status
                            let syncStatus = ''
                            let syncColor = ''
                            if (platformCount === 0) {
                              syncStatus = '❌ Chưa đồng bộ'
                              syncColor = 'text-red-600 bg-red-50'
                            } else if (linkMismatch || platformCount !== priceCount) {
                              syncStatus = '⚠️ Thiếu dữ liệu'
                              syncColor = 'text-yellow-600 bg-yellow-50'
                            } else if (platformCount > 0 && platformCount === priceCount) {
                              syncStatus = '✅ Hoàn chỉnh'
                              syncColor = 'text-green-600 bg-green-50'
                            }

                            return (
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {productUrl ? (
                                    <a
                                      href={productUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline"
                                      title={`Xem sản phẩm trên website: ${r?.title}`}
                                    >
                                      {r?.title || 'Untitled'}
                                    </a>
                                  ) : (
                                    <span>{r?.title || 'Untitled'}</span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-xs gap-2">
                                  <span className="text-gray-500">
                                    ID: {r?.website_id || 'N/A'}
                                  </span>
                                  <div className="flex items-center gap-1">
                                  </div>
                                </div>
                                {/* Last updated info */}
                                {r?.updated_at && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    {(() => {
                                      const date = new Date(r.updated_at)
                                      const isToday = date.toDateString() === new Date().toDateString()
                                      const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                      const dateStr = isToday ? 'Hôm nay' : date.toLocaleDateString('vi-VN')
                                      return `Cập nhật: ${dateStr} ${timeStr}`
                                    })()}
                                  </div>
                                )}
                                {/* Stock status under product title */}
                                <div className="mt-1">
                                  {(() => {
                                    const hetHangValue = r?.het_hang
                                    const { isOutOfStock, isInStock } = getStockStatus(hetHangValue)


                                    return (
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        isOutOfStock
                                          ? 'bg-red-100 text-red-700'
                                          : isInStock
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {isOutOfStock ? 'Hết hàng' : isInStock ? 'Còn hàng' : 'Chưa set'}
                                      </span>
                                    )
                                  })()}
                                </div>
                                {/* Update status under product title */}
                                {isCurrentlyEditing && (
                                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500 text-white mt-1">
                                    📝 Editing
                                  </div>
                                )}
                                {isRecentlyUpdated && !isCurrentlyEditing && (
                                  <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-500 text-white mt-1">
                                    ✨ Just updated
                                  </div>
                                )}
                              </div>
                            )
                          }


                          // Handle image field (show thumbnail instead of link)
                          if (f === 'image_url') {
                            const imageUrl = r?.image_url
                            if (!imageUrl) return <span className="text-gray-400 text-xs">-</span>

                            return (
                              <div className="flex items-center justify-center">
                                <img
                                  src={imageUrl}
                                  alt={r?.title || 'Product image'}
                                  className="w-12 h-12 object-cover rounded border"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                    ;(e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden')
                                  }}
                                />
                                <div className="hidden text-gray-400 text-xs">🖼️</div>
                              </div>
                            )
                          }

                          
                          // Handle regular fields
                          const value = r?.[f]
                          
                          if (f === 'price' && value > 0) {
                            return (
                              <span className="font-medium text-green-600">
                                {new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)}₫
                              </span>
                            )
                          }
                          
                          if (f === 'promotional_price' && value > 0) {
                            return (
                              <span className="font-medium text-red-600">
                                {new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)}₫
                              </span>
                            )
                          }
                          
                          // Handle het_hang as stock status display
                          if (f === 'het_hang') {
                            const { isOutOfStock, isInStock } = getStockStatus(value)
                            return (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                isOutOfStock
                                  ? 'bg-red-100 text-red-700'
                                  : isInStock
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {isOutOfStock ? '❌ Hết hàng' : isInStock ? '✅ Còn hàng' : '⚪ Chưa set'}
                              </span>
                            )
                          }

                          // Handle external_url as clickable text link
                          if (f === 'external_url' && value) {
                            return (
                              <a
                                href={value}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 hover:underline text-sm"
                                title={value}
                              >
                                🔗 Link
                              </a>
                            )
                          }


                          return value != null ? String(value) : (<span className="muted">-</span>)
                        })()}
                      </td>
                    ))}
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button 
                          className={`neo-btn text-xs px-2 py-1 transition-all ${
                            isCurrentlyEditing 
                              ? 'bg-blue-500 text-white shadow-lg' 
                              : 'hover:bg-blue-50'
                          }`}
                          onClick={() => openEditSidebar(r)}
                        >
                          {isCurrentlyEditing ? '📝 Editing' : 'Edit'}
                        </button>
                        <button 
                          className={`neo-btn text-xs px-2 py-1 transition-all ${
                            isSyncing 
                              ? 'bg-orange-500 text-white' 
                              : 'hover:bg-orange-50'
                          }`}
                          onClick={() => syncProductFromWebsite(r)}
                          disabled={isSyncing}
                          title="Sync from WooCommerce website"
                        >
                          {isSyncing ? (
                            <span className="flex items-center gap-1">
                              <span className="animate-spin">🔄</span>
                            </span>
                          ) : (
                            '🔄 Sync'
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline Edit Form - appears directly under the product row */}
                  {isCurrentlyEditing && editedProduct && (
                    <tr className="bg-blue-50 border-b-2 border-blue-200">
                      <td colSpan={visibleFields.length + 2} className="p-0">
                        <div className="animate-slideDown">
                          <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-400">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <span className="text-blue-600">📝</span> Edit Product
                              </h3>
                              <div className="flex gap-2">
                                <button
                                  className={`neo-btn transition-all ${hasChanges() ? 'primary shadow-lg' : 'bg-gray-200'}`}
                                  onClick={updateProduct}
                                  disabled={!hasChanges() || isUpdating}
                                >
                                  {isUpdating ? (
                                    <span className="flex items-center gap-1">
                                      <span className="animate-spin">⏳</span> Updating DB & WooCommerce
                                    </span>
                                  ) : hasChanges() ? (
                                    <span className="flex items-center gap-1">
                                      💾 Update All
                                    </span>
                                  ) : (
                                    'Lưu'
                                  )}
                                </button>
                                <button
                                  className="neo-btn text-sm"
                                  onClick={closeEditSidebar}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>

                            {/* Status and Auto-update Summary */}
                            <div className="mb-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <span>SKU: {editedProduct?.sku || 'N/A'}</span>
                                <span>ID: {editedProduct?.id || 'N/A'}</span>
                              </div>
                              {recentlyUpdated.has(String(editedProduct?.id)) && (
                                <div className="text-green-600 font-medium text-sm">
                                  ✨ Recently updated
                                </div>
                              )}

                              {priceAutoUpdated && autoUpdateSummary && (
                                <div className="bg-yellow-100 border border-yellow-300 rounded p-2 text-sm">
                                  <span className="font-medium text-yellow-800">🔄 Auto-update applied: </span>
                                  <span className="text-yellow-700">{autoUpdateSummary}</span>
                                </div>
                              )}
                            </div>

                            {/* Form Fields - Grid Layout */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {ALL_FIELDS.map((field) => (
                                <div key={field} className={`p-3 rounded-lg border transition-all ${isFieldChanged(field) ? 'bg-yellow-50 border-yellow-300 shadow-sm' : 'bg-white border-gray-200'}`}>
                                  <label className={`block text-sm font-medium mb-2 capitalize ${isFieldChanged(field) ? 'text-yellow-800' : 'text-gray-700'}`}>
                                    <span className="flex items-center gap-2">
                                      {field.replace('_', ' ')}
                                      {isFieldChanged(field) && <span className="text-yellow-600">●</span>}
                                    </span>
                                  </label>

                                  {/* Platform fields (shopee, tiktok, etc.) with link and price inputs */}
                                  {['shopee', 'tiktok', 'lazada', 'dmx', 'tiki'].includes(field) ? (
                                    <div className="space-y-2">
                                      <input
                                        type="url"
                                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        value={editedProduct[`link_${field}`] || ''}
                                        onChange={(e) => handleFieldChange(`link_${field}`, e.target.value)}
                                        placeholder="https://..."
                                      />
                                      <input
                                        type="number"
                                        className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                        value={editedProduct[`gia_${field}`] || ''}
                                        onChange={(e) => handleFieldChange(`gia_${field}`, parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                      />
                                    </div>
                                  ) : field === 'description' ? (
                                    <textarea
                                      className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                      rows={3}
                                      value={editedProduct[field] || ''}
                                      onChange={(e) => handleFieldChange(field, e.target.value)}
                                      placeholder="Product description..."
                                    />
                                  ) : ['price', 'promotional_price'].includes(field) ? (
                                    <input
                                      type="number"
                                      className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                      value={editedProduct[field] || ''}
                                      onChange={(e) => handleFieldChange(field, parseInt(e.target.value) || 0)}
                                      placeholder="0"
                                    />
                                  ) : field === 'het_hang' ? (
                                    <select
                                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                      value={editedProduct[field] === true ? 'true' : editedProduct[field] === false ? 'false' : ''}
                                      onChange={(e) => {
                                        const value = e.target.value === 'true' ? true : e.target.value === 'false' ? false : null
                                        handleFieldChange(field, value)
                                      }}
                                    >
                                      <option value="">Chưa set</option>
                                      <option value="false">Còn hàng</option>
                                      <option value="true">Hết hàng</option>
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                      value={editedProduct[field] || ''}
                                      onChange={(e) => handleFieldChange(field, e.target.value)}
                                      placeholder={`Enter ${field.replace('_', ' ')}`}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Additional fields that might exist in the database */}
                            {editedProduct && Object.keys(editedProduct).filter(key =>
                              !ALL_FIELDS.includes(key) &&
                              !['id', 'created_at', 'updated_at', 'raw', 'meta'].includes(key) &&
                              !PLATFORM_FIELDS.includes(key) // Exclude all platform fields
                            ).length > 0 && (
                              <div className="mt-6">
                                <h4 className="text-sm font-medium text-gray-700 mb-3">Additional Fields</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {Object.keys(editedProduct).filter(key =>
                                    !ALL_FIELDS.includes(key) &&
                                    !['id', 'created_at', 'updated_at', 'raw', 'meta'].includes(key) &&
                                    !PLATFORM_FIELDS.includes(key) // Exclude all platform fields
                                  ).map((field) => (
                                    <div key={field} className="p-3 rounded-lg border bg-gray-50">
                                      <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                                        {field.replace('_', ' ')}
                                      </label>
                                      <input
                                        type="text"
                                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        value={editedProduct[field] || ''}
                                        onChange={(e) => handleFieldChange(field, e.target.value)}
                                        placeholder={`Enter ${field.replace('_', ' ')}`}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>

          {/* Product Management Tools - Only in Products Page */}
          <div className="mt-6">
            <ProductManagementCenter
              onSyncComplete={onSyncComplete || handleReloadProducts}
              onReloadProducts={onReloadProducts || handleReloadProducts}
            />
          </div>
        </>
      )}
    </div>
  )
}
