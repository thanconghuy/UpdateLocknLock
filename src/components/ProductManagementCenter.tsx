import React, { useState, useRef } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { wooCommerceService } from '../services/woocommerce'
import { ENV, hasRequiredEnvVars } from '../config/env'
import { detectPlatformLinks } from '../utils/links'
import { parsePriceText } from '../utils/priceUtils'
import { syncMissingProducts, checkMissingProducts, updateAllProductsStockStatus, updateStockStatusOnly, comprehensiveProductSync, type SyncReport } from '../utils/productSyncChecker'
import type { ProductData } from '../types'

interface SyncProgress {
  total: number
  processed: number
  newProducts: number
  updated: number
  errors: number
  currentProduct?: string
}

interface SyncResult {
  success: boolean
  message: string
  stats: {
    total: number
    newProducts: number
    updated: number
    errors: number
  }
}

interface Props {
  onSyncComplete?: () => void // Callback to refresh product list
  onReloadProducts?: () => void // Callback to reload product data
}

export default function ProductManagementCenter({ onSyncComplete, onReloadProducts }: Props) {
  const [activeTab, setActiveTab] = useState<'sync' | 'report'>('sync')

  // Sync tab state
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)

  // Report tab state
  const [isReporting, setIsReporting] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [report, setReport] = useState<SyncReport | null>(null)
  const [checkResult, setCheckResult] = useState<any>(null)

  // Stock update state
  const [isUpdatingStock, setIsUpdatingStock] = useState(false)
  const [stockUpdateResult, setStockUpdateResult] = useState<{updated: number, errors: string[]} | null>(null)

  // Reload products state
  const [isReloadingProducts, setIsReloadingProducts] = useState(false)
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string | null>(null)
  const [lastSyncCount, setLastSyncCount] = useState<number>(0)

  const clientRef = useRef<SupabaseClient | null>(null)

  // Initialize Supabase client
  React.useEffect(() => {
    if (hasRequiredEnvVars()) {
      const client = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY)
      clientRef.current = client
    }
  }, [])

  // === SYNC FUNCTIONALITY ===
  const fetchAllWooCommerceProducts = async (): Promise<any[]> => {
    const allProducts: any[] = []
    let page = 1
    const perPage = 100

    try {
      while (true) {
        setSyncStatus(`Fetching products page ${page}...`)

        const products = await wooCommerceService.getProducts({
          page,
          per_page: perPage,
          status: 'publish'
        })

        if (!products || products.length === 0) {
          break
        }

        allProducts.push(...products)
        page++

        setSyncProgress(prev => prev ? {
          ...prev,
          currentProduct: `Fetched ${allProducts.length} products...`
        } : null)

        if (products.length < perPage) {
          break
        }
      }

      return allProducts
    } catch (error) {
      console.error('Error fetching WooCommerce products:', error)
      throw new Error(`Failed to fetch products: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const getExistingProducts = async (): Promise<Set<string>> => {
    if (!clientRef.current) {
      throw new Error('Database not connected')
    }

    try {
      const { data, error } = await clientRef.current
        .from(ENV.DEFAULT_PRODUCTS_TABLE)
        .select('website_id')

      if (error) {
        throw new Error(`Database error: ${error.message}`)
      }

      return new Set(data?.map(item => item.website_id.toString()) || [])
    } catch (error) {
      console.error('Error fetching existing products:', error)
      throw error
    }
  }

  const mapWooProductToProductData = (wooProduct: any): ProductData => {
    console.log(`⚡ Fast mapping for product ${wooProduct.id}: essential meta only`)

    // Extract essential platform data from meta_data only (skip description parsing for speed)
    const metaData = wooProduct.meta_data || []
    const platformData = {
      linkShopee: '',
      giaShopee: null as number | null,
      linkTiktok: '',
      giaTiktok: null as number | null,
      linkLazada: '',
      giaLazada: null as number | null,
      linkDmx: '',
      giaDmx: null as number | null,
      linkTiki: '',
      giaTiki: null as number | null,
    }

    // Extract platform links, prices and stock status from meta_data efficiently
    let hetHang = false // Default: Còn hàng

    metaData.forEach((meta: any) => {
      switch (meta.key) {
        case 'link_shopee':
          platformData.linkShopee = meta.value?.trim() || ''
          break
        case 'gia_shopee':
          platformData.giaShopee = parsePriceText(meta.value) || null
          break
        case 'link_tiktok':
          platformData.linkTiktok = meta.value?.trim() || ''
          break
        case 'gia_tiktok':
          platformData.giaTiktok = parsePriceText(meta.value) || null
          break
        case 'link_lazada':
          platformData.linkLazada = meta.value?.trim() || ''
          break
        case 'gia_lazada':
          platformData.giaLazada = parsePriceText(meta.value) || null
          break
        case 'link_dmx':
          platformData.linkDmx = meta.value?.trim() || ''
          break
        case 'gia_dmx':
          platformData.giaDmx = parsePriceText(meta.value) || null
          break
        case 'link_tiki':
          platformData.linkTiki = meta.value?.trim() || ''
          break
        case 'gia_tiki':
          platformData.giaTiki = parsePriceText(meta.value) || null
          break
        case 'het_hang':
          // Extract stock status: "Còn hàng" or "Hết hàng"
          const stockValue = String(meta.value).trim()
          hetHang = stockValue === 'Hết hàng'
          console.log(`📦 Stock status for product ${wooProduct.id}: "${stockValue}" -> ${hetHang ? 'Hết hàng' : 'Còn hàng'}`)
          break
      }
    })

    return {
      id: '',
      websiteId: wooProduct.id.toString(),
      title: wooProduct.name?.trim() || '',
      price: parsePriceText(wooProduct.regular_price || '0'),
      promotionalPrice: parsePriceText(wooProduct.sale_price || '0'),
      sku: wooProduct.sku?.trim() || '',
      imageUrl: wooProduct.images?.[0]?.src?.trim() || '',
      externalUrl: wooProduct.permalink?.trim() || '',
      currency: 'VND',
      // Platform links and prices from meta_data
      linkShopee: platformData.linkShopee,
      giaShopee: platformData.giaShopee,
      linkTiktok: platformData.linkTiktok,
      giaTiktok: platformData.giaTiktok,
      linkLazada: platformData.linkLazada,
      giaLazada: platformData.giaLazada,
      linkDmx: platformData.linkDmx,
      giaDmx: platformData.giaDmx,
      linkTiki: platformData.linkTiki,
      giaTiki: platformData.giaTiki,
      // Stock status from meta_data
      hetHang: hetHang,
      // Skip for speed optimization: category, description
    }
  }

  const syncProductsToDatabase = async (products: ProductData[]): Promise<SyncResult> => {
    if (!clientRef.current) {
      throw new Error('Database not connected')
    }

    const chunkSize = 50
    let newProducts = 0
    let updated = 0
    let errors = 0

    try {
      for (let i = 0; i < products.length; i += chunkSize) {
        const chunk = products.slice(i, i + chunkSize)

        setSyncProgress(prev => prev ? {
          ...prev,
          processed: i,
          currentProduct: `Syncing batch ${Math.floor(i / chunkSize) + 1}...`
        } : null)

        const payload = chunk.map(product => ({
          // Essential meta only for optimized sync performance
          website_id: product.websiteId,
          title: product.title,
          sku: product.sku,
          price: product.price,
          promotional_price: product.promotionalPrice,
          image_url: product.imageUrl,
          external_url: product.externalUrl,
          currency: product.currency,
          // Stock status from meta_data
          het_hang: product.hetHang || false,
          // Platform links and prices
          link_shopee: product.linkShopee,
          gia_shopee: product.giaShopee,
          link_tiktok: product.linkTiktok,
          gia_tiktok: product.giaTiktok,
          link_lazada: product.linkLazada,
          gia_lazada: product.giaLazada,
          link_dmx: product.linkDmx,
          gia_dmx: product.giaDmx,
          link_tiki: product.linkTiki,
          gia_tiki: product.giaTiki,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Skip for performance: category, description
        }))

        const { error } = await clientRef.current
          .from(ENV.DEFAULT_PRODUCTS_TABLE)
          .upsert(payload, {
            onConflict: 'website_id',
            ignoreDuplicates: false
          })

        if (error) {
          console.error('Batch upsert error:', error)
          errors += chunk.length
        } else {
          newProducts += chunk.length
        }

        await new Promise(resolve => setTimeout(resolve, 100))
      }

      return {
        success: true,
        message: `Sync completed: ${newProducts} products processed, ${errors} errors`,
        stats: {
          total: products.length,
          newProducts,
          updated,
          errors
        }
      }
    } catch (error) {
      console.error('Sync error:', error)
      return {
        success: false,
        message: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stats: {
          total: products.length,
          newProducts,
          updated,
          errors: errors + 1
        }
      }
    }
  }

  const handleSyncProducts = async () => {
    if (isSyncing) return

    if (!hasRequiredEnvVars()) {
      setSyncStatus('❌ Environment variables not configured')
      return
    }

    if (!clientRef.current) {
      setSyncStatus('❌ Database not connected')
      return
    }

    const confirmMessage =
      '⚡ Đồng bộ tối ưu sản phẩm từ WooCommerce\n\n' +
      'Chức năng này sẽ đồng bộ các meta thiết yếu:\n' +
      '📝 • Tên sản phẩm, ID, SKU\n' +
      '💰 • Giá thường & Giá khuyến mãi\n' +
      '🖼️ • Hình ảnh & URL ngoài\n' +
      '🔗 • Platform Links: Shopee, TikTok, Tiki, Lazada, DMX\n' +
      '💵 • Giá từng platform & Tiền tệ\n' +
      '📦 • Trạng thái kho (Còn hàng/Hết hàng)\n\n' +
      '🚀 Tối ưu tốc độ:\n' +
      '• Bỏ qua: Category, Mô tả\n' +
      '• Xử lý nhanh hơn 50-70%\n' +
      '• Chỉ sync dữ liệu cần thiết\n\n' +
      '⚠️ Lưu ý:\n' +
      '• 🗑️ Xóa sản phẩm không còn trên WooCommerce\n' +
      '• 📥 Thêm sản phẩm mới\n' +
      '• 🔄 Cập nhật sản phẩm hiện có\n' +
      '• Xem Console (F12) để theo dõi\n\n' +
      'Tiếp tục đồng bộ tối ưu?'

    const confirmSync = window.confirm(confirmMessage)
    if (!confirmSync) return

    setIsSyncing(true)
    setSyncStatus('⚡ Starting optimized sync with essential meta only...')
    setSyncProgress({
      total: 0,
      processed: 0,
      newProducts: 0,
      updated: 0,
      errors: 0
    })

    try {
      console.clear()
      console.log('⚡ OPTIMIZED PRODUCT SYNC PROCESS STARTED')
      console.log('🚀 COMPREHENSIVE SYNC WITH PERFORMANCE OPTIMIZATION')
      console.log('='.repeat(80))
      console.log('⏰ ' + new Date().toLocaleString('vi-VN'))
      console.log('🔧 Tool: UpdateLocknLock Optimized Sync')
      console.log('📊 Scope: Essential meta fields only for maximum speed')
      console.log('='.repeat(80))

      setSyncStatus('⚡ Fast analyzing products and syncing essential data...')

      const result = await comprehensiveProductSync()

      // Convert comprehensive sync result to expected format
      setLastSyncResult({
        success: result.success,
        message: result.message,
        stats: {
          total: result.stats.totalWooProducts,
          newProducts: result.stats.newProductsAdded,
          updated: result.stats.productsUpdated,
          errors: result.stats.errors
        }
      })

      setSyncStatus(result.success ? '⚡ Optimized sync completed successfully!' : '❌ Optimized sync completed with errors')

      // Call the callback to refresh product list
      if ((result.stats.newProductsAdded > 0 || result.stats.productsUpdated > 0 || result.stats.productsDeleted > 0) && onSyncComplete) {
        console.log('🔄 Calling onSyncComplete to refresh UI...')
        onSyncComplete()
      }

      // Show detailed results
      if (result.stats.newProductsAdded > 0 || result.stats.productsUpdated > 0 || result.stats.productsDeleted > 0) {
        alert(
          `⚡ Đồng bộ tối ưu thành công!\n\n` +
          `📊 Kết quả đồng bộ:\n` +
          `• 🛒 WooCommerce: ${result.stats.totalWooProducts} sản phẩm\n` +
          `• 🔧 Tool trước đó: ${result.stats.totalToolProducts} sản phẩm\n` +
          `• ➕ Thêm mới: ${result.stats.newProductsAdded} sản phẩm\n` +
          `• 🔄 Cập nhật: ${result.stats.productsUpdated} sản phẩm\n` +
          `• 🗑️ Xóa: ${result.stats.productsDeleted} sản phẩm\n` +
          `• ❌ Lỗi: ${result.stats.errors}\n\n` +
          `🎉 Tool hiện có: ${result.stats.totalToolProducts + result.stats.newProductsAdded - result.stats.productsDeleted} sản phẩm\n\n` +
          `⚡ Đã sync meta thiết yếu:\n` +
          `• Tên, ID, SKU, Giá, Hình ảnh, URL\n` +
          `• Platform Links & Prices (5 platforms)\n` +
          `• Trạng thái kho (Còn hàng/Hết hàng)\n` +
          `• Tốc độ tối ưu: Bỏ qua category, mô tả\n\n` +
          `📋 Chi tiết trong Console (F12)!`
        )
      } else if (result.success) {
        alert(
          '✅ Tất cả sản phẩm đã được đồng bộ!\n\n' +
          `📊 Thống kê:\n` +
          `• 🛒 WooCommerce: ${result.stats.totalWooProducts} sản phẩm\n` +
          `• 🔧 Tool: ${result.stats.totalToolProducts} sản phẩm\n` +
          `• Không có thay đổi nào cần thiết\n\n` +
          '🎉 Database đã được cập nhật hoàn toàn!'
        )
      } else {
        alert(
          `⚠️ Đồng bộ hoàn tất với lỗi\n\n` +
          `📊 Kết quả:\n` +
          `• ➕ Thêm mới: ${result.stats.newProductsAdded} sản phẩm\n` +
          `• 🔄 Cập nhật: ${result.stats.productsUpdated} sản phẩm\n` +
          `• 🗑️ Xóa: ${result.stats.productsDeleted} sản phẩm\n` +
          `• ❌ Lỗi: ${result.stats.errors}\n\n` +
          `📋 Xem Console (F12) để biết chi tiết các lỗi!`
        )
      }

    } catch (error) {
      console.error('❌ COMPREHENSIVE SYNC PROCESS FAILED:', error)
      setSyncStatus(`❌ Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setLastSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        stats: { total: 0, newProducts: 0, updated: 0, errors: 1 }
      })

      alert(
        `❌ Đồng bộ toàn diện thất bại!\n\n` +
        `Lỗi: ${error instanceof Error ? error.message : 'Lỗi không xác định'}\n\n` +
        `💡 Gợi ý khắc phục:\n` +
        `• Kiểm tra kết nối internet\n` +
        `• Kiểm tra WooCommerce API credentials\n` +
        `• Kiểm tra Supabase database connection\n` +
        `• Xem Console (F12) để biết chi tiết\n\n` +
        `📞 Liên hệ support nếu vấn đề vẫn tiếp tục!`
      )
    } finally {
      setIsSyncing(false)
      setSyncProgress(null)
    }
  }

  // === REPORT FUNCTIONALITY ===
  const handleCheckMissingProducts = async () => {
    if (isChecking || isReporting) return

    if (!hasRequiredEnvVars()) {
      alert('❌ Environment variables not configured')
      return
    }

    setIsChecking(true)
    setCheckResult(null)

    try {
      console.log('🔍 Starting check for missing products...')
      const result = await checkMissingProducts()
      setCheckResult(result)

      console.log('📊 Check completed:')
      console.log(`- Tool database: ${result.report.toolProducts} products`)
      console.log(`- WooCommerce: ${result.report.wooProducts} products`)
      console.log(`- Missing: ${result.report.missingProducts} products`)

      if (result.missing.length > 0) {
        console.log('📋 Missing products list:')
        result.missing.forEach((product, index) => {
          console.log(`${index + 1}. [${product.websiteId}] ${product.title} - ${product.price.toLocaleString('vi-VN')}₫`)
        })
      }

    } catch (error) {
      console.error('❌ Check failed:', error)
      alert(`Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsChecking(false)
    }
  }

  const handleSyncMissingProducts = async () => {
    if (isReporting || isChecking) return

    if (!hasRequiredEnvVars()) {
      alert('❌ Environment variables not configured')
      return
    }

    const confirmMessage =
      '🚀 Đồng bộ sản phẩm từ WooCommerce về Tool\n\n' +
      'Chức năng này sẽ:\n' +
      '📊 1. Lấy danh sách tất cả sản phẩm từ website WooCommerce\n' +
      '🔍 2. So sánh với database hiện tại của tool\n' +
      '📋 3. Hiển thị chi tiết các sản phẩm chưa có trong tool\n' +
      '💾 4. Thêm từng sản phẩm thiếu vào database\n' +
      '📈 5. Báo cáo kết quả chi tiết\n\n' +
      '⚠️ Lưu ý: \n' +
      '• Quá trình có thể mất vài phút với catalog lớn\n' +
      '• Tất cả thông tin chi tiết sẽ hiển thị trong Console\n' +
      '• Không có sản phẩm nào bị xóa, chỉ thêm mới\n\n' +
      '👀 Mở Console (F12) để xem chi tiết quá trình!\n\n' +
      'Tiếp tục?'

    const confirmSync = window.confirm(confirmMessage)
    if (!confirmSync) return

    setIsReporting(true)
    setReport(null)

    try {
      console.clear()
      console.log('🚀 PRODUCT SYNC PROCESS STARTED')
      console.log('='.repeat(80))
      console.log('⏰ ' + new Date().toLocaleString('vi-VN'))
      console.log('🔧 Tool: UpdateLocknLock Product Sync')
      console.log('='.repeat(80))

      const syncReport = await syncMissingProducts()
      setReport(syncReport)

      // Call the callback to refresh product list
      if (syncReport.newlyAdded > 0 && onSyncComplete) {
        onSyncComplete()
      }

      if (syncReport.newlyAdded > 0) {
        alert(
          `✅ Đồng bộ thành công!\n\n` +
          `📊 Kết quả:\n` +
          `• Website có: ${syncReport.wooProducts} sản phẩm\n` +
          `• Tool trước đó có: ${syncReport.toolProducts} sản phẩm\n` +
          `• Tìm thấy thiếu: ${syncReport.missingProducts} sản phẩm\n` +
          `• Đã thêm thành công: ${syncReport.newlyAdded} sản phẩm\n` +
          `• Lỗi: ${syncReport.errors.length}\n\n` +
          `🎉 Tool database hiện có: ${syncReport.toolProducts + syncReport.newlyAdded} sản phẩm\n\n` +
          `📋 Xem Console (F12) để biết chi tiết từng sản phẩm đã thêm!`
        )
      } else if (syncReport.missingProducts === 0) {
        alert(
          '✅ Tất cả sản phẩm đã được đồng bộ!\n\n' +
          `📊 Thống kê:\n` +
          `• Website: ${syncReport.wooProducts} sản phẩm\n` +
          `• Tool: ${syncReport.toolProducts} sản phẩm\n` +
          `• Không có sản phẩm nào thiếu\n\n` +
          '🎉 Database đã được cập nhật hoàn toàn!'
        )
      } else {
        alert(
          `⚠️ Đồng bộ hoàn tất với một số lỗi\n\n` +
          `📊 Kết quả:\n` +
          `• Tìm thấy thiếu: ${syncReport.missingProducts} sản phẩm\n` +
          `• Thêm thành công: ${syncReport.newlyAdded} sản phẩm\n` +
          `• Lỗi: ${syncReport.errors.length}\n\n` +
          `📋 Xem Console (F12) để biết chi tiết các lỗi!`
        )
      }

    } catch (error) {
      console.error('❌ SYNC PROCESS FAILED:', error)
      alert(
        `❌ Đồng bộ thất bại!\n\n` +
        `Lỗi: ${error instanceof Error ? error.message : 'Lỗi không xác định'}\n\n` +
        `💡 Gợi ý khắc phục:\n` +
        `• Kiểm tra kết nối internet\n` +
        `• Kiểm tra WooCommerce API credentials\n` +
        `• Kiểm tra Supabase database connection\n` +
        `• Xem Console (F12) để biết chi tiết\n\n` +
        `📞 Liên hệ support nếu vấn đề vẫn tiếp tục!`
      )
    } finally {
      setIsReporting(false)
    }
  }

  const getFinalStockCounts = async (): Promise<{instock: number, outofstock: number}> => {
    if (!clientRef.current) {
      return { instock: 0, outofstock: 0 }
    }

    try {
      const { data, error } = await clientRef.current
        .from(ENV.DEFAULT_PRODUCTS_TABLE)
        .select('het_hang')

      if (error) {
        console.error('Error counting stock status:', error)
        return { instock: 0, outofstock: 0 }
      }

      const counts = { instock: 0, outofstock: 0 }
      data?.forEach((item: any) => {
        if (item.het_hang) {
          counts.outofstock++
        } else {
          counts.instock++
        }
      })

      console.log('📊 Final stock counts:', counts)
      return counts
    } catch (error) {
      console.error('Exception counting stock status:', error)
      return { instock: 0, outofstock: 0 }
    }
  }

  const handleUpdateStockStatus = async () => {
    if (isUpdatingStock) return

    if (!hasRequiredEnvVars()) {
      alert('❌ Environment variables not configured')
      return
    }

    const confirmMessage =
      '📦 Cập nhật trạng thái kho từ WooCommerce\n\n' +
      'Chức năng này sẽ:\n' +
      '🔍 1. Kiểm tra custom field "het_hang" từ WooCommerce\n' +
      '📊 2. Thống kê số lượng "Còn hàng" và "Hết hàng"\n' +
      '🔄 3. Cập nhật trạng thái kho trong database\n' +
      '📄 4. Load lại trang sản phẩm với dữ liệu mới\n' +
      '📈 5. Báo cáo kết quả chi tiết\n\n' +
      '⚠️ Lưu ý: \n' +
      '• Chỉ cập nhật stock status, không thêm sản phẩm mới\n' +
      '• Xem Console (F12) để theo dõi chi tiết\n\n' +
      'Tiếp tục cập nhật stock status?'

    const confirmUpdate = window.confirm(confirmMessage)
    if (!confirmUpdate) return

    setIsUpdatingStock(true)
    setStockUpdateResult(null)

    try {
      console.clear()
      console.log('📦 STOCK STATUS UPDATE PROCESS STARTED')
      console.log('='.repeat(80))
      console.log('⏰ ' + new Date().toLocaleString('vi-VN'))
      console.log('🔧 Tool: UpdateLocknLock Stock Status Update')
      console.log('='.repeat(80))

      // Use the new updateStockStatusOnly function
      const result = await updateStockStatusOnly()

      setStockUpdateResult({
        updated: result.updated,
        errors: result.errors
      })

      // Call the callback to refresh product list
      if (result.updated > 0 && onSyncComplete) {
        console.log('🔄 Calling onSyncComplete to refresh UI...')
        onSyncComplete()
      }

      if (result.updated > 0) {
        alert(
          `✅ Cập nhật trạng thái kho thành công!\n\n` +
          `📊 Thống kê từ WooCommerce:\n` +
          `• 🟢 "Còn hàng": ${result.wooStats.inStock} sản phẩm\n` +
          `• 🔴 "Hết hàng": ${result.wooStats.outOfStock} sản phẩm\n` +
          `• 📦 Tổng số: ${result.wooStats.total} sản phẩm\n\n` +
          `🔄 Kết quả cập nhật:\n` +
          `• ✅ Đã cập nhật: ${result.updated} sản phẩm\n` +
          `• ❌ Lỗi: ${result.errors.length}\n\n` +
          `📊 Trạng thái kho sau cập nhật:\n` +
          `• 🟢 Còn hàng: ${result.finalStats.inStock} sản phẩm\n` +
          `• 🔴 Hết hàng: ${result.finalStats.outOfStock} sản phẩm\n\n` +
          `🎉 Trạng thái kho đã được đồng bộ với WooCommerce!\n\n` +
          `📋 Xem Console (F12) để biết chi tiết quá trình!`
        )
      } else if (result.errors.length > 0) {
        alert(
          `⚠️ Cập nhật hoàn tất với lỗi\n\n` +
          `📊 Thống kê từ WooCommerce:\n` +
          `• 🟢 "Còn hàng": ${result.wooStats.inStock} sản phẩm\n` +
          `• 🔴 "Hết hàng": ${result.wooStats.outOfStock} sản phẩm\n\n` +
          `🔄 Kết quả:\n` +
          `• ✅ Cập nhật: ${result.updated} sản phẩm\n` +
          `• ❌ Lỗi: ${result.errors.length}\n\n` +
          `📋 Xem Console (F12) để biết chi tiết các lỗi!`
        )
      } else {
        alert(
          `ℹ️ Không có thay đổi stock status nào\n\n` +
          `📊 Thống kê từ WooCommerce:\n` +
          `• 🟢 "Còn hàng": ${result.wooStats.inStock} sản phẩm\n` +
          `• 🔴 "Hết hàng": ${result.wooStats.outOfStock} sản phẩm\n\n` +
          `✅ Tất cả sản phẩm đã có stock status đúng!\n\n` +
          `📊 Trạng thái kho hiện tại:\n` +
          `• 🟢 Còn hàng: ${result.finalStats.inStock} sản phẩm\n` +
          `• 🔴 Hết hàng: ${result.finalStats.outOfStock} sản phẩm`
        )
      }

    } catch (error) {
      console.error('❌ STOCK UPDATE PROCESS FAILED:', error)
      alert(
        `❌ Cập nhật trạng thái kho thất bại!\n\n` +
        `Lỗi: ${error instanceof Error ? error.message : 'Lỗi không xác định'}\n\n` +
        `💡 Gợi ý khắc phục:\n` +
        `• Kiểm tra kết nối internet\n` +
        `• Kiểm tra WooCommerce API credentials\n` +
        `• Kiểm tra Supabase database connection\n` +
        `• Xem Console (F12) để biết chi tiết\n\n` +
        `📞 Liên hệ support nếu vấn đề vẫn tiếp tục!`
      )
    } finally {
      setIsUpdatingStock(false)
    }
  }

  const handleReloadProducts = async () => {
    if (isReloadingProducts) return

    if (!hasRequiredEnvVars()) {
      alert('❌ Environment variables not configured')
      return
    }

    const confirmMessage = 'Có muốn đồng bộ tất cả sản phẩm không?'

    const confirmReload = window.confirm(confirmMessage)
    if (!confirmReload) return

    setIsReloadingProducts(true)
    setLastSyncResult(null)

    try {
      console.clear()
      console.log('🔄 RELOAD ALL PRODUCTS - SYNC FROM WOOCOMMERCE STARTED')
      console.log('='.repeat(60))
      console.log('⏰ ' + new Date().toLocaleString('vi-VN'))
      console.log('🔧 Tool: UpdateLocknLock - Sync All Products from WooCommerce')
      console.log('='.repeat(60))

      // Use the comprehensive sync functionality
      const result = await comprehensiveProductSync()

      // Set sync result for UI display
      setLastSyncResult({
        success: result.success,
        message: result.message,
        stats: {
          total: result.stats.totalWooProducts,
          newProducts: result.stats.newProductsAdded,
          updated: result.stats.productsUpdated,
          errors: result.stats.errors
        }
      })

      // Update sync tracking
      setLastSyncTimestamp(new Date().toLocaleString('vi-VN'))
      setLastSyncCount(result.stats.totalWooProducts)

      // Wait for database operations to complete before refreshing UI
      console.log('🔄 Waiting 2 seconds for database operations to commit...')
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Call the callback to refresh product list
      if ((result.stats.newProductsAdded > 0 || result.stats.productsUpdated > 0 || result.stats.productsDeleted > 0) && onSyncComplete) {
        console.log('🔄 Calling onSyncComplete to refresh UI...')
        onSyncComplete()
      }

      // Show detailed results
      if (result.stats.newProductsAdded > 0 || result.stats.productsUpdated > 0 || result.stats.productsDeleted > 0) {
        alert(
          `✅ Đồng bộ tất cả sản phẩm thành công!\n\n` +
          `📊 Kết quả:\n` +
          `• 🛒 WooCommerce có: ${result.stats.totalWooProducts} sản phẩm\n` +
          `• 🔧 Tool trước đó có: ${result.stats.totalToolProducts} sản phẩm\n` +
          `• ➕ Thêm mới: ${result.stats.newProductsAdded} sản phẩm\n` +
          `• 🔄 Cập nhật: ${result.stats.productsUpdated} sản phẩm\n` +
          `• 🗑️ Xóa: ${result.stats.productsDeleted} sản phẩm\n` +
          `• ❌ Lỗi: ${result.stats.errors}\n\n` +
          `🎉 Tool hiện có: ${result.stats.totalToolProducts + result.stats.newProductsAdded - result.stats.productsDeleted} sản phẩm\n\n` +
          `📋 Xem Console (F12) để biết chi tiết quá trình!`
        )
      } else if (result.success) {
        alert(
          '✅ Tất cả sản phẩm đã được đồng bộ!\n\n' +
          `📊 Thống kê:\n` +
          `• 🛒 WooCommerce: ${result.stats.totalWooProducts} sản phẩm\n` +
          `• 🔧 Tool: ${result.stats.totalToolProducts} sản phẩm\n` +
          `• Không có thay đổi nào cần thiết\n\n` +
          '🎉 Database đã được cập nhật hoàn toàn!'
        )
      } else {
        alert(
          `⚠️ Đồng bộ hoàn tất với lỗi\n\n` +
          `📊 Kết quả:\n` +
          `• ➕ Thêm mới: ${result.stats.newProductsAdded} sản phẩm\n` +
          `• 🔄 Cập nhật: ${result.stats.productsUpdated} sản phẩm\n` +
          `• 🗑️ Xóa: ${result.stats.productsDeleted} sản phẩm\n` +
          `• ❌ Lỗi: ${result.stats.errors}\n\n` +
          `📋 Xem Console (F12) để biết chi tiết các lỗi!`
        )
      }

    } catch (error) {
      console.error('❌ RELOAD ALL PRODUCTS - SYNC PROCESS FAILED:', error)

      setLastSyncResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        stats: { total: 0, newProducts: 0, updated: 0, errors: 1 }
      })

      alert(
        `❌ Đồng bộ tất cả sản phẩm thất bại!\n\n` +
        `Lỗi: ${error instanceof Error ? error.message : 'Lỗi không xác định'}\n\n` +
        `💡 Gợi ý khắc phục:\n` +
        `• Kiểm tra kết nối internet\n` +
        `• Kiểm tra WooCommerce API credentials\n` +
        `• Kiểm tra Supabase database connection\n` +
        `• Xem Console (F12) để biết chi tiết\n\n` +
        `📞 Liên hệ support nếu vấn đề vẫn tiếp tục!`
      )
    } finally {
      setIsReloadingProducts(false)
    }
  }

  const isReady = hasRequiredEnvVars() && clientRef.current
  const isAnyLoading = isSyncing || isReporting || isChecking || isUpdatingStock || isReloadingProducts

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header with Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between p-4 pb-0">
          <h3 className="font-semibold text-gray-800">Product Management Center</h3>
          {isReady && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              ✓ Ready
            </span>
          )}
        </div>

        <div className="flex">
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'sync'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('sync')}
          >
            🔄 Smart Sync
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'report'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('report')}
          >
            📊 Sync Report
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'sync' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              ⚡ Optimized sync: Fast synchronization of essential meta fields only (Title, SKU, Prices, Images, Platform Links, Stock Status). Skip category, description for maximum speed.
            </div>

            {syncStatus && (
              <div className="text-sm p-2 bg-gray-50 rounded">
                Status: {syncStatus}
              </div>
            )}

            {syncProgress && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  Progress: {syncProgress.processed} / {syncProgress.total}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: syncProgress.total > 0 ? `${(syncProgress.processed / syncProgress.total) * 100}%` : '0%'
                    }}
                  />
                </div>
                {syncProgress.currentProduct && (
                  <div className="text-xs text-gray-500">
                    {syncProgress.currentProduct}
                  </div>
                )}
              </div>
            )}

            {lastSyncResult && (
              <div className={`text-sm p-2 rounded ${
                lastSyncResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                <div className="font-medium">{lastSyncResult.message}</div>
                <div className="text-xs mt-1">
                  Total: {lastSyncResult.stats.total} |
                  New: {lastSyncResult.stats.newProducts} |
                  Errors: {lastSyncResult.stats.errors}
                </div>
              </div>
            )}

            <button
              className={`w-full px-4 py-3 rounded font-medium ${
                isReady && !isAnyLoading
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
              onClick={handleSyncProducts}
              disabled={!isReady || isAnyLoading}
            >
              {isSyncing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Optimized Syncing...
                </span>
              ) : (
                '⚡ Optimized Sync from WooCommerce'
              )}
            </button>
          </div>
        )}

        {activeTab === 'report' && (
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Compare and sync missing products between WooCommerce and your tool database.
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <button
                className={`px-4 py-2 rounded font-medium text-sm ${
                  isReady && !isAnyLoading
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={handleCheckMissingProducts}
                disabled={!isReady || isAnyLoading}
              >
                {isChecking ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Checking...
                  </span>
                ) : (
                  '🔍 Check Missing Products'
                )}
              </button>

              <button
                className={`px-4 py-2 rounded font-medium text-sm ${
                  isReady && !isAnyLoading
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={handleSyncMissingProducts}
                disabled={!isReady || isAnyLoading}
              >
                {isReporting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Syncing...
                  </span>
                ) : (
                  '🚀 Sync Missing Products'
                )}
              </button>

              <button
                className={`px-4 py-2 rounded font-medium text-sm ${
                  isReady && !isAnyLoading
                    ? 'bg-orange-600 text-white hover:bg-orange-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={handleUpdateStockStatus}
                disabled={!isReady || isAnyLoading}
              >
                {isUpdatingStock ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Updating...
                  </span>
                ) : (
                  '📦 Update Stock Status'
                )}
              </button>

              <button
                className={`px-4 py-2 rounded font-medium text-sm ${
                  isReady && !isAnyLoading
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                onClick={handleReloadProducts}
                disabled={!isReady || isAnyLoading}
              >
                {isReloadingProducts ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Syncing...
                  </span>
                ) : (
                  '⚡ Sync All Products'
                )}
              </button>
            </div>

            {/* Check Results */}
            {checkResult && (
              <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                <h4 className="font-medium text-blue-800 mb-2">📊 Check Results</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  <div>Tool Database: <span className="font-medium">{checkResult.report.toolProducts}</span> products</div>
                  <div>WooCommerce: <span className="font-medium">{checkResult.report.wooProducts}</span> products</div>
                  <div>Missing Products: <span className="font-medium text-red-600">{checkResult.report.missingProducts}</span> products</div>
                </div>

                {checkResult.missing.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-blue-800 mb-2">Missing Products (First 10):</div>
                    <div className="text-xs text-blue-600 space-y-1 max-h-32 overflow-y-auto">
                      {checkResult.missing.slice(0, 10).map((product: any, index: number) => (
                        <div key={product.websiteId} className="flex justify-between">
                          <span>{index + 1}. [{product.websiteId}] {product.title}</span>
                          <span className="font-medium">{product.price.toLocaleString('vi-VN')}₫</span>
                        </div>
                      ))}
                      {checkResult.missing.length > 10 && (
                        <div className="text-gray-500 italic">... and {checkResult.missing.length - 10} more</div>
                      )}
                    </div>
                  </div>
                )}

                {checkResult.missing.length === 0 && (
                  <div className="mt-2 text-green-600 font-medium">✅ All products are already synced!</div>
                )}
              </div>
            )}

            {/* Stock Update Results */}
            {stockUpdateResult && (
              <div className={`p-3 rounded border-l-4 ${
                stockUpdateResult.errors.length === 0
                  ? 'bg-green-50 border-green-400'
                  : 'bg-yellow-50 border-yellow-400'
              }`}>
                <h4 className={`font-medium mb-2 ${
                  stockUpdateResult.errors.length === 0 ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  📦 Stock Status Update Results
                </h4>

                <div className={`text-sm space-y-1 ${
                  stockUpdateResult.errors.length === 0 ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  <div>Products Updated: <span className="font-medium text-green-600">{stockUpdateResult.updated}</span></div>
                  <div>Errors: <span className="font-medium text-red-600">{stockUpdateResult.errors.length}</span></div>
                </div>

                {stockUpdateResult.errors.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-red-800 mb-1">❌ Errors:</div>
                    <div className="text-xs text-red-600 space-y-1 max-h-24 overflow-y-auto">
                      {stockUpdateResult.errors.map((error, index) => (
                        <div key={index}>• {error}</div>
                      ))}
                    </div>
                  </div>
                )}

                {stockUpdateResult.errors.length === 0 && stockUpdateResult.updated > 0 && (
                  <div className="mt-2 text-green-600 font-medium">
                    ✅ Successfully updated stock status for {stockUpdateResult.updated} products!
                  </div>
                )}
              </div>
            )}

            {/* Sync Results */}
            {report && (
              <div className={`p-3 rounded border-l-4 ${
                report.errors.length === 0
                  ? 'bg-green-50 border-green-400'
                  : 'bg-yellow-50 border-yellow-400'
              }`}>
                <h4 className={`font-medium mb-2 ${
                  report.errors.length === 0 ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  🎯 Sync Results
                </h4>

                <div className={`text-sm space-y-1 ${
                  report.errors.length === 0 ? 'text-green-700' : 'text-yellow-700'
                }`}>
                  <div>Tool Products: <span className="font-medium">{report.toolProducts}</span></div>
                  <div>WooCommerce Products: <span className="font-medium">{report.wooProducts}</span></div>
                  <div>Missing Found: <span className="font-medium">{report.missingProducts}</span></div>
                  <div>Successfully Added: <span className="font-medium text-green-600">{report.newlyAdded}</span></div>
                  <div>Errors: <span className="font-medium text-red-600">{report.errors.length}</span></div>
                </div>

                {report.errors.length > 0 && (
                  <div className="mt-3">
                    <div className="text-sm font-medium text-red-800 mb-1">❌ Errors:</div>
                    <div className="text-xs text-red-600 space-y-1 max-h-24 overflow-y-auto">
                      {report.errors.map((error, index) => (
                        <div key={index}>• {error}</div>
                      ))}
                    </div>
                  </div>
                )}

                {report.errors.length === 0 && report.newlyAdded > 0 && (
                  <div className="mt-2 text-green-600 font-medium">
                    ✅ Successfully synced {report.newlyAdded} missing products!
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
              <div className="font-medium mb-1">📋 Instructions:</div>
              <div className="space-y-1">
                <div>• <strong>Check:</strong> Compare products without making changes</div>
                <div>• <strong>Sync:</strong> Add missing products to database</div>
                <div>• <strong>Update Stock:</strong> Update stock status for all existing products</div>
                <div>• <strong>Sync All Products:</strong> Sync all products from WooCommerce to tool database</div>
                <div>• Results will be shown here and logged to console</div>
                {lastSyncTimestamp && (
                  <div className="mt-2 pt-2 border-t border-gray-300">
                    <div className="font-medium text-green-600">📊 Đồng bộ lần cuối:</div>
                    <div className="text-green-600">⏰ Thời gian: {lastSyncTimestamp}</div>
                    <div className="text-green-600">📦 Số sản phẩm: {lastSyncCount.toLocaleString('vi-VN')}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!isReady && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ WooCommerce or database connection not configured. Check environment variables.
          </div>
        )}
      </div>
    </div>
  )
}