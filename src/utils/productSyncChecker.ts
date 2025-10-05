import { supabase } from '../lib/supabase'
import { WooCommerceService } from '../services/woocommerce'
import { hasRequiredEnvVars } from '../config/env'
import { detectPlatformLinks } from './links'
import { parsePriceText } from './priceUtils'
import { ProductService } from '../services/productService'
import type { ProductData, ProductDataDB } from '../types'
import type { Project } from '../types/project'

export interface SyncReport {
  toolProducts: number
  wooProducts: number
  missingProducts: number
  newlyAdded: number
  errors: string[]
  missingProductsList: ProductDataDB[]
}

export class ProductSyncChecker {
  private supabase = hasRequiredEnvVars() ? supabase : null
  private currentProject: Project | null = null

  constructor(project?: Project) {
    this.currentProject = project || null
  }

  private getProductsTable(): string {
    if (!this.currentProject) {
      throw new Error('No project selected for sync operation')
    }
    // Always use products_new for consistency and project isolation
    return 'products_new'
  }

  async checkAndSyncMissingProducts(): Promise<SyncReport> {
    const report: SyncReport = {
      toolProducts: 0,
      wooProducts: 0,
      missingProducts: 0,
      newlyAdded: 0,
      errors: [],
      missingProductsList: []
    }

    try {
      if (!this.supabase) {
        throw new Error('❌ Database not configured. Please check your environment variables.')
      }

      console.log('🚀 Starting comprehensive product sync process...')
      console.log('=' .repeat(60))

      // Step 1: Get current products in tool database
      console.log('📊 STEP 1: Analyzing current tool database...')
      const toolProducts = await this.getToolProducts()
      report.toolProducts = toolProducts.length
      console.log(`✅ Tool database contains: ${toolProducts.length} products`)

      // Step 2: Get all products from WooCommerce website
      console.log('\n🛒 STEP 2: Fetching products from WooCommerce website...')
      const wooProducts = await this.getAllWooCommerceProducts()
      report.wooProducts = wooProducts.length
      console.log(`✅ WooCommerce website has: ${wooProducts.length} products`)

      // Step 3: Identify missing products with detailed analysis
      console.log('\n🔍 STEP 3: Analyzing differences between website and tool...')
      const missingProducts = await this.findMissingProducts(toolProducts, wooProducts)
      report.missingProducts = missingProducts.length
      report.missingProductsList = missingProducts

      // Show detailed analysis
      if (missingProducts.length === 0) {
        console.log('🎉 ANALYSIS COMPLETE: All products are perfectly synced!')
        console.log('   ✅ No missing products found')
        console.log('   ✅ Tool database is up to date with website')
        return report
      }

      // Show missing products details
      console.log(`🔍 FOUND: ${missingProducts.length} products missing from tool database`)
      console.log('\n📋 MISSING PRODUCTS LIST:')
      console.log('-'.repeat(80))

      missingProducts.forEach((product, index) => {
        console.log(`${(index + 1).toString().padStart(3, ' ')}. [ID: ${product.website_id}] ${product.title}`)
        console.log(`     💰 Price: ${product.price?.toLocaleString('vi-VN')}₫${product.promotional_price ? ` (Sale: ${product.promotional_price.toLocaleString('vi-VN')}₫)` : ''}`)
        console.log(`     📦 SKU: ${product.sku || 'N/A'}`)
        console.log(`     📂 Category: ${product.category || 'N/A'}`)
        if (product.link_shopee || product.link_tiktok || product.link_lazada || product.link_dmx || product.link_tiki) {
          const platforms = []
          if (product.link_shopee) platforms.push('Shopee')
          if (product.link_tiktok) platforms.push('TikTok')
          if (product.link_lazada) platforms.push('Lazada')
          if (product.link_dmx) platforms.push('DMX')
          if (product.link_tiki) platforms.push('Tiki')
          console.log(`     🔗 Platform links: ${platforms.join(', ')}`)
        }
        console.log('')
      })

      // Step 4: Confirm and proceed with sync
      console.log('💾 STEP 4: Adding missing products to tool database...')
      console.log(`📝 About to process ${missingProducts.length} products in batches...`)

      const addResult = await this.addMissingProducts(missingProducts)
      report.newlyAdded = addResult.success
      report.errors = addResult.errors

      // Final results
      console.log('\n' + '='.repeat(60))
      console.log('🎯 SYNC PROCESS COMPLETED')
      console.log('='.repeat(60))
      console.log(`📊 Website products: ${report.wooProducts}`)
      console.log(`📊 Tool products (before): ${report.toolProducts}`)
      console.log(`📊 Missing products found: ${report.missingProducts}`)
      console.log(`✅ Successfully added: ${addResult.success}`)
      console.log(`❌ Failed to add: ${addResult.errors.length}`)
      console.log(`📊 Tool products (after): ${report.toolProducts + addResult.success}`)

      if (addResult.errors.length > 0) {
        console.log('\n❌ ERRORS ENCOUNTERED:')
        addResult.errors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`)
        })
      }

      if (addResult.success > 0) {
        console.log(`\n🎉 SUCCESS: ${addResult.success} products have been added to your tool database!`)
        console.log('   💡 You can now manage these products in your tool interface')
      }

      return report

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ SYNC PROCESS FAILED:', errorMsg)
      report.errors.push(errorMsg)
      return report
    }
  }

  private async getToolProducts(): Promise<Array<{website_id: string}>> {
    if (!this.currentProject) {
      throw new Error('No project selected for sync operation')
    }

    try {
      const { data: products } = await ProductService.getProjectProducts(this.currentProject.project_id)
      return products.map(p => ({ website_id: p.websiteId || p.id }))
    } catch (error) {
      console.error('❌ Error getting tool products:', error)
      throw new Error(`Failed to get tool products: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async getAllWooCommerceProducts(): Promise<any[]> {
    const allProducts: any[] = []
    let page = 1
    const perPage = 100

    try {
      while (true) {
        if (!this.currentProject) {
          throw new Error('No project selected for WooCommerce sync')
        }

        const products = await WooCommerceService.getProducts({
          page,
          per_page: perPage,
          status: 'publish'
        }, this.currentProject)

        if (!products || products.length === 0) {
          break
        }

        allProducts.push(...products)
        console.log(`   📄 Page ${page}: ${products.length} products (Total: ${allProducts.length})`)
        page++

        // Break if we got less than perPage items (last page)
        if (products.length < perPage) {
          break
        }

        // Small delay to be nice to the API
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      return allProducts
    } catch (error) {
      throw new Error(`Failed to fetch WooCommerce products: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async findMissingProducts(toolProducts: Array<{website_id: string}>, wooProducts: any[]): Promise<ProductDataDB[]> {
    const toolProductIds = new Set(toolProducts.map(p => p.website_id.toString()))

    const missingWooProducts = wooProducts.filter(wooProduct =>
      !toolProductIds.has(wooProduct.id.toString())
    )

    console.log(`   🔍 Tool has: ${toolProductIds.size} products`)
    console.log(`   🛒 WooCommerce has: ${wooProducts.length} products`)
    console.log(`   ❌ Missing: ${missingWooProducts.length} products`)

    // Convert missing WooCommerce products to ProductData format
    const missingProducts: ProductDataDB[] = missingWooProducts.map(wooProduct => {
      return this.mapWooProductToProductData(wooProduct)
    })

    return missingProducts
  }

  private mapWooProductToProductData(wooProduct: any): ProductDataDB {
    console.log(`🔍 Optimized mapping for product ${wooProduct.id}: extracting essential meta only`)

    // Extract essential platform data from meta_data only (no description parsing for speed)
    const metaData = wooProduct.meta_data || []
    const platformData = {
      link_shopee: '',
      gia_shopee: null as number | null,
      link_tiktok: '',
      gia_tiktok: null as number | null,
      link_lazada: '',
      gia_lazada: null as number | null,
      link_dmx: '',
      gia_dmx: null as number | null,
      link_tiki: '',
      gia_tiki: null as number | null,
    }

    // Extract platform links, prices and stock status from meta_data efficiently
    let hetHang = false // Default: Còn hàng

    metaData.forEach((meta: any) => {
      switch (meta.key) {
        case 'link_shopee':
          platformData.link_shopee = meta.value?.trim() || ''
          break
        case 'gia_shopee':
          platformData.gia_shopee = parsePriceText(meta.value) || null
          break
        case 'link_tiktok':
          platformData.link_tiktok = meta.value?.trim() || ''
          break
        case 'gia_tiktok':
          platformData.gia_tiktok = parsePriceText(meta.value) || null
          break
        case 'link_lazada':
          platformData.link_lazada = meta.value?.trim() || ''
          break
        case 'gia_lazada':
          platformData.gia_lazada = parsePriceText(meta.value) || null
          break
        case 'link_dmx':
          platformData.link_dmx = meta.value?.trim() || ''
          break
        case 'gia_dmx':
          platformData.gia_dmx = parsePriceText(meta.value) || null
          break
        case 'link_tiki':
          platformData.link_tiki = meta.value?.trim() || ''
          break
        case 'gia_tiki':
          platformData.gia_tiki = parsePriceText(meta.value) || null
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
      id: '', // Will be set by database
      project_id: this.currentProject?.project_id, // Add project isolation
      website_id: wooProduct.id.toString(),
      title: wooProduct.name?.trim() || '',
      price: parsePriceText(wooProduct.regular_price || '0'),
      promotional_price: parsePriceText(wooProduct.sale_price || '0') || null,
      sku: wooProduct.sku?.trim() || '',
      image_url: wooProduct.images?.[0]?.src?.trim() || '',
      external_url: wooProduct.permalink?.trim() || '',

      // Platform links and prices from meta_data (snake_case format)
      link_shopee: platformData.link_shopee,
      gia_shopee: platformData.gia_shopee,
      link_tiktok: platformData.link_tiktok,
      gia_tiktok: platformData.gia_tiktok,
      link_lazada: platformData.link_lazada,
      gia_lazada: platformData.gia_lazada,
      link_dmx: platformData.link_dmx,
      gia_dmx: platformData.gia_dmx,
      link_tiki: platformData.link_tiki,
      gia_tiki: platformData.gia_tiki,

      // Stock status from meta_data
      het_hang: hetHang,

      // Timestamps
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),

      // Skip other meta to optimize speed
      // - category: not synced for performance
      // - description: not synced for performance
    }
  }

  private async addMissingProducts(products: ProductDataDB[]): Promise<{success: number, errors: string[]}> {
    if (!this.supabase) throw new Error('Database not connected')

    const chunkSize = 50
    let successCount = 0
    const errors: string[] = []
    const addedProducts: string[] = []

    console.log(`\n⚡ OPTIMIZED SYNC: Processing ${products.length} products with essential meta only`)
    console.log(`📦 Processing in ${Math.ceil(products.length / chunkSize)} batches for optimal speed...`)

    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize)
      const batchNumber = Math.floor(i / chunkSize) + 1
      const totalBatches = Math.ceil(products.length / chunkSize)

      console.log(`\n📦 BATCH ${batchNumber}/${totalBatches}: Processing ${chunk.length} products...`)

      // Show products in this batch
      chunk.forEach((product, index) => {
        console.log(`   ${i + index + 1}. [${product.website_id}] ${product.title} - ${product.price?.toLocaleString('vi-VN')}₫`)
      })

      const payload = chunk.map(product => ({
        // Essential meta only for optimized sync
        project_id: this.currentProject?.project_id, // Add project isolation
        website_id: product.website_id,
        title: product.title,
        sku: product.sku,
        price: product.price,
        promotional_price: product.promotional_price,
        image_url: product.image_url,
        external_url: product.external_url,
        // Stock status from meta_data
        het_hang: product.het_hang || false,
        // Platform links and prices
        link_shopee: product.link_shopee,
        gia_shopee: product.gia_shopee,
        link_tiktok: product.link_tiktok,
        gia_tiktok: product.gia_tiktok,
        link_lazada: product.link_lazada,
        gia_lazada: product.gia_lazada,
        link_dmx: product.link_dmx,
        gia_dmx: product.gia_dmx,
        link_tiki: product.link_tiki,
        gia_tiki: product.gia_tiki,
        created_at: product.created_at || new Date().toISOString(),
        updated_at: product.updated_at || new Date().toISOString(),
        // Skip for performance: category, description
      }))

      try {
        console.log(`   🔄 Sending batch ${batchNumber} to database...`)

        const { data, error } = await this.supabase
          .from(this.getProductsTable())
          .upsert(payload, {
            onConflict: 'website_id,project_id'
          })

        if (error) {
          const errorMsg = `❌ Batch ${batchNumber} failed: ${error.message}`
          console.error(errorMsg)
          errors.push(errorMsg)

          // Log which products failed
          console.log('   📋 Failed products in this batch:')
          chunk.forEach((product, index) => {
            console.log(`      ${i + index + 1}. [${product.website_id}] ${product.title}`)
          })
        } else {
          successCount += chunk.length
          console.log(`   ✅ Batch ${batchNumber} SUCCESS: ${chunk.length} products added to database`)

          // Track added products
          chunk.forEach((product, index) => {
            addedProducts.push(`[${product.website_id}] ${product.title}`)
          })
        }

        // Progress indicator
        const progressPercent = Math.round(((i + chunk.length) / products.length) * 100)
        console.log(`   📈 Progress: ${i + chunk.length}/${products.length} (${progressPercent}%)`)

        // Small delay between batches to be nice to the database
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error) {
        const errorMsg = `❌ Batch ${batchNumber} exception: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)

        console.log('   📋 Products that failed due to exception:')
        chunk.forEach((product, index) => {
          console.log(`      ${i + index + 1}. [${product.website_id}] ${product.title}`)
        })
      }
    }

    // Summary of added products
    if (addedProducts.length > 0) {
      console.log(`\n✅ SUCCESSFULLY ADDED PRODUCTS (${addedProducts.length} total):`)
      console.log('='.repeat(60))
      addedProducts.forEach((product, index) => {
        console.log(`   ${(index + 1).toString().padStart(3, ' ')}. ${product}`)
      })
    }

    return { success: successCount, errors }
  }

  // Method to just check without syncing
  async checkMissingProductsOnly(): Promise<{missing: ProductDataDB[], report: Omit<SyncReport, 'newlyAdded' | 'errors'>}> {
    const toolProducts = await this.getToolProducts()
    const wooProducts = await this.getAllWooCommerceProducts()
    const missingProducts = await this.findMissingProducts(toolProducts, wooProducts)

    return {
      missing: missingProducts,
      report: {
        toolProducts: toolProducts.length,
        wooProducts: wooProducts.length,
        missingProducts: missingProducts.length,
        missingProductsList: missingProducts
      }
    }
  }

  // Method to update stock status for all existing products
  async updateAllProductsStockStatus(): Promise<{updated: number, errors: string[]}> {
    if (!this.supabase) throw new Error('Database not connected')

    const errors: string[] = []
    let updated = 0

    try {
      console.log('🔄 UPDATING STOCK STATUS FOR ALL PRODUCTS')
      console.log('='.repeat(60))

      // Get all tool products with their website_id
      const { data: toolProducts, error: toolError } = await this.supabase
        .from(this.getProductsTable())
        .select('id, website_id, title')
        .eq('project_id', this.currentProject!.project_id)
        .eq('project_id', this.currentProject!.project_id)

      if (toolError) {
        throw new Error(`Failed to get tool products: ${toolError.message}`)
      }

      if (!toolProducts || toolProducts.length === 0) {
        console.log('ℹ️ No products found in tool database')
        return { updated: 0, errors: [] }
      }

      console.log(`📊 Found ${toolProducts.length} products in tool database`)
      console.log('🛒 Fetching current stock status from WooCommerce...')

      // Get all WooCommerce products with stock status
      const wooProducts = await this.getAllWooCommerceProducts()
      const wooProductsMap = new Map(
        wooProducts.map(p => [p.id.toString(), p])
      )

      console.log(`📦 Processing stock status updates...`)

      // Process in batches
      const batchSize = 50
      const batches = Math.ceil(toolProducts.length / batchSize)

      for (let i = 0; i < toolProducts.length; i += batchSize) {
        const batch = toolProducts.slice(i, i + batchSize)
        const batchNum = Math.floor(i / batchSize) + 1

        console.log(`\n📦 BATCH ${batchNum}/${batches}: Processing ${batch.length} products...`)

        const updates = []

        for (const toolProduct of batch) {
          const wooProduct = wooProductsMap.get(toolProduct.website_id)

          if (wooProduct) {
            // Extract het_hang from meta_data custom field
            let hetHang = false
            if (wooProduct.meta_data && Array.isArray(wooProduct.meta_data)) {
              const hetHangMeta = wooProduct.meta_data.find((meta: any) => meta.key === 'het_hang')
              if (hetHangMeta) {
                // Handle text values: "Còn hàng" or "Hết hàng"
                const value = String(hetHangMeta.value).trim()
                hetHang = value === 'Hết hàng'
              } else {
                // Default to "Còn hàng" (not out of stock) when no custom field found
                hetHang = false
              }
            } else {
              // Default to "Còn hàng" when no meta_data at all
              hetHang = false
            }

            updates.push({
              id: toolProduct.id,
              het_hang: hetHang,
              updated_at: new Date().toISOString()
            })

            console.log(`   ${hetHang ? '❌' : '✅'} [${toolProduct.website_id}] ${toolProduct.title} - ${hetHang ? 'Hết hàng' : 'Còn hàng'}`)
          } else {
            console.log(`   ⚠️ [${toolProduct.website_id}] ${toolProduct.title} - Not found on WooCommerce`)
          }
        }

        // Update database for this batch
        if (updates.length > 0) {
          try {
            for (const update of updates) {
              const { error, data } = await this.supabase
                .from(this.getProductsTable())
                .update({
                  het_hang: update.het_hang,
                  updated_at: update.updated_at
                })
                .eq('id', update.id)
                .select('id, het_hang')

              if (error) {
                const errorMsg = `Failed to update product ID ${update.id}: ${error.message}`
                errors.push(errorMsg)
                console.error(`   ❌ ${errorMsg}`)
              } else {
                if (data && data.length > 0) {
                  updated++
                } else {
                  console.warn(`   ⚠️ Update completed but no data returned for ID ${update.id} - row might not exist`)
                }
              }
            }

            console.log(`   ✅ Batch ${batchNum} completed: ${updates.length} products processed`)
          } catch (error) {
            const errorMsg = `Batch ${batchNum} exception: ${error instanceof Error ? error.message : 'Unknown error'}`
            errors.push(errorMsg)
            console.error(`   ❌ ${errorMsg}`)
          }
        }

        // Progress indicator
        const progress = Math.round(((i + batch.length) / toolProducts.length) * 100)
        console.log(`   📈 Overall Progress: ${i + batch.length}/${toolProducts.length} (${progress}%)`)

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      console.log('\n' + '='.repeat(60))
      console.log('🎯 STOCK STATUS UPDATE COMPLETED')
      console.log('='.repeat(60))
      console.log(`📊 Products processed: ${toolProducts.length}`)
      console.log(`✅ Successfully updated: ${updated}`)
      console.log(`❌ Errors: ${errors.length}`)

      if (errors.length > 0) {
        console.log('\n❌ ERRORS:')
        errors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`)
        })
      }

      if (updated > 0) {
        console.log(`\n🎉 SUCCESS: Updated stock status for ${updated} products!`)
      }

      return { updated, errors }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Stock status update failed:', errorMsg)
      errors.push(errorMsg)
      return { updated, errors }
    }
  }

  // Method to update stock status only with detailed statistics
  async updateStockStatusOnly(): Promise<{
    success: boolean
    message: string
    beforeStats: { instock: number, outofstock: number, total: number }
    afterStats: { instock: number, outofstock: number, total: number }
    updated: number
    errors: string[]
  }> {
    if (!this.supabase) throw new Error('Database not connected')

    const errors: string[] = []
    let updated = 0

    try {
      console.log('📦 STOCK STATUS UPDATE PROCESS STARTED')
      console.log('='.repeat(60))

      // Step 1: Get current tool products
      const { data: toolProducts, error: toolError } = await this.supabase
        .from(this.getProductsTable())
        .select('id, website_id, title, het_hang')
        .eq('project_id', this.currentProject!.project_id)

      if (toolError) {
        throw new Error(`Failed to get tool products: ${toolError.message}`)
      }

      if (!toolProducts || toolProducts.length === 0) {
        console.log('ℹ️ No products found in tool database')
        return {
          success: false,
          message: 'No products found in database',
          beforeStats: { instock: 0, outofstock: 0, total: 0 },
          afterStats: { instock: 0, outofstock: 0, total: 0 },
          updated: 0,
          errors: ['No products found in database']
        }
      }

      // Step 2: Count current stock status in database
      console.log('📊 STEP 1: Analyzing current stock status in database...')
      const beforeStats = { instock: 0, outofstock: 0, total: toolProducts.length }
      toolProducts.forEach((product: any) => {
        const { isOutOfStock } = this.getStockStatusFromValue(product.het_hang)
        if (isOutOfStock) {
          beforeStats.outofstock++
        } else {
          beforeStats.instock++
        }
      })

      console.log(`📊 Current database status:`)
      console.log(`   ✅ Còn hàng: ${beforeStats.instock} products`)
      console.log(`   ❌ Hết hàng: ${beforeStats.outofstock} products`)
      console.log(`   📦 Total: ${beforeStats.total} products`)

      // Step 3: Get stock status from WooCommerce
      console.log('\n🛒 STEP 2: Fetching current stock status from WooCommerce...')
      const wooProducts = await this.getAllWooCommerceProducts()
      const wooProductsMap = new Map(
        wooProducts.map(p => [p.id.toString(), p])
      )

      console.log(`🛒 Fetched ${wooProducts.length} products from WooCommerce`)

      // Step 4: Analyze WooCommerce stock status
      console.log('\n📋 STEP 3: Analyzing WooCommerce stock status...')
      const wooStats = { instock: 0, outofstock: 0 }
      wooProducts.forEach((wooProduct: any) => {
        const { isOutOfStock } = this.getStockStatusFromMetaData(wooProduct.meta_data)
        if (isOutOfStock) {
          wooStats.outofstock++
        } else {
          wooStats.instock++
        }
      })

      console.log(`📋 WooCommerce stock status:`)
      console.log(`   ✅ Còn hàng: ${wooStats.instock} products`)
      console.log(`   ❌ Hết hàng: ${wooStats.outofstock} products`)

      // Step 5: Update products in batches
      console.log('\n🔄 STEP 4: Updating stock status in database...')
      const batchSize = 50
      const batches = Math.ceil(toolProducts.length / batchSize)

      for (let i = 0; i < toolProducts.length; i += batchSize) {
        const batch = toolProducts.slice(i, i + batchSize)
        const batchNum = Math.floor(i / batchSize) + 1

        console.log(`\n📦 BATCH ${batchNum}/${batches}: Processing ${batch.length} products...`)

        for (const toolProduct of batch) {
          const wooProduct = wooProductsMap.get(toolProduct.website_id)

          if (wooProduct) {
            // Get het_hang status from WooCommerce
            const { isOutOfStock } = this.getStockStatusFromMetaData(wooProduct.meta_data)
            const newHetHang = isOutOfStock

            // Only update if different
            const currentHetHang = toolProduct.het_hang
            const currentIsOutOfStock = this.getStockStatusFromValue(currentHetHang).isOutOfStock

            if (currentIsOutOfStock !== newHetHang) {
              try {
                const { error } = await this.supabase
                  .from(this.getProductsTable())
                  .update({
                    het_hang: newHetHang,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', toolProduct.id)

                if (error) {
                  const errorMsg = `Failed to update product ID ${toolProduct.id}: ${error.message}`
                  errors.push(errorMsg)
                  console.error(`   ❌ ${errorMsg}`)
                } else {
                  updated++
                  console.log(`   ✅ [${toolProduct.website_id}] ${toolProduct.title} - ${currentIsOutOfStock ? 'Hết hàng' : 'Còn hàng'} → ${newHetHang ? 'Hết hàng' : 'Còn hàng'}`)
                }
              } catch (error) {
                const errorMsg = `Exception updating product ID ${toolProduct.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
                errors.push(errorMsg)
                console.error(`   ❌ ${errorMsg}`)
              }
            } else {
              console.log(`   ✨ [${toolProduct.website_id}] ${toolProduct.title} - No change needed (${newHetHang ? 'Hết hàng' : 'Còn hàng'})`)
            }
          } else {
            console.log(`   ⚠️ [${toolProduct.website_id}] ${toolProduct.title} - Not found on WooCommerce`)
          }
        }

        // Progress indicator
        const progress = Math.round(((i + batch.length) / toolProducts.length) * 100)
        console.log(`   📈 Progress: ${i + batch.length}/${toolProducts.length} (${progress}%)`)
      }

      // Step 6: Count final stock status
      console.log('\n📊 STEP 5: Counting final stock status...')
      const { data: finalProducts, error: finalError } = await this.supabase
        .from(this.getProductsTable())
        .select('het_hang')
        .eq('project_id', this.currentProject!.project_id)

      if (finalError) {
        console.error('Failed to get final counts:', finalError.message)
        errors.push(`Failed to get final counts: ${finalError.message}`)
      }

      const afterStats = { instock: 0, outofstock: 0, total: finalProducts?.length || 0 }
      if (finalProducts) {
        finalProducts.forEach((product: any) => {
          const { isOutOfStock } = this.getStockStatusFromValue(product.het_hang)
          if (isOutOfStock) {
            afterStats.outofstock++
          } else {
            afterStats.instock++
          }
        })
      }

      // Final results
      console.log('\n' + '='.repeat(60))
      console.log('🎯 STOCK STATUS UPDATE COMPLETED')
      console.log('='.repeat(60))
      console.log(`📊 Results Summary:`)
      console.log(`   📦 Total products: ${beforeStats.total}`)
      console.log(`   🔄 Updated: ${updated}`)
      console.log(`   ❌ Errors: ${errors.length}`)
      console.log(`\n📈 Stock Status Changes:`)
      console.log(`   Before: ✅ ${beforeStats.instock} | ❌ ${beforeStats.outofstock}`)
      console.log(`   After:  ✅ ${afterStats.instock} | ❌ ${afterStats.outofstock}`)
      console.log(`   Net change: ${afterStats.instock - beforeStats.instock} Còn hàng, ${afterStats.outofstock - beforeStats.outofstock} Hết hàng`)

      if (errors.length > 0) {
        console.log('\n❌ ERRORS:')
        errors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`)
        })
      }

      const message = updated > 0
        ? `Successfully updated ${updated} products stock status`
        : 'No products needed stock status update'

      return {
        success: errors.length === 0,
        message,
        beforeStats,
        afterStats,
        updated,
        errors
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Stock status update failed:', errorMsg)
      errors.push(errorMsg)
      return {
        success: false,
        message: `Stock status update failed: ${errorMsg}`,
        beforeStats: { instock: 0, outofstock: 0, total: 0 },
        afterStats: { instock: 0, outofstock: 0, total: 0 },
        updated: 0,
        errors
      }
    }
  }

  private getStockStatusFromValue(hetHangValue: any) {
    const isOutOfStock =
      hetHangValue === true ||
      hetHangValue === 'true' ||
      hetHangValue === 'Hết hàng' ||
      hetHangValue === 'hết hàng' ||
      hetHangValue === 1

    return { isOutOfStock }
  }

  private getStockStatusFromMetaData(metaData: any[]) {
    if (!metaData || !Array.isArray(metaData)) {
      return { isOutOfStock: false } // Default to "Còn hàng"
    }

    const hetHangMeta = metaData.find((meta: any) => meta.key === 'het_hang')
    if (hetHangMeta) {
      const value = String(hetHangMeta.value).trim()
      return { isOutOfStock: value === 'Hết hàng' }
    }

    return { isOutOfStock: false } // Default to "Còn hàng" when no custom field found
  }

  // Method to find products that exist in tool but no longer exist in WooCommerce
  async findDeletedProducts(): Promise<Array<{id: string, website_id: string, title: string}>> {
    if (!this.supabase) throw new Error('Database not connected')

    try {
      // Get all tool products
      const { data: toolProducts, error: toolError } = await this.supabase
        .from(this.getProductsTable())
        .select('id, website_id, title')
        .eq('project_id', this.currentProject!.project_id)

      if (toolError) {
        throw new Error(`Failed to get tool products: ${toolError.message}`)
      }

      if (!toolProducts || toolProducts.length === 0) {
        return []
      }

      // Get all WooCommerce products
      const wooProducts = await this.getAllWooCommerceProducts()
      const wooProductIds = new Set(wooProducts.map(p => p.id.toString()))

      // Find products in tool that don't exist in WooCommerce
      const deletedProducts = toolProducts.filter(toolProduct =>
        !wooProductIds.has(toolProduct.website_id)
      )

      return deletedProducts
    } catch (error) {
      throw new Error(`Failed to find deleted products: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Method to delete products from database
  async deleteProductsFromDatabase(productIds: string[]): Promise<{deleted: number, errors: string[]}> {
    if (!this.supabase) throw new Error('Database not connected')

    const errors: string[] = []
    let deleted = 0

    if (productIds.length === 0) {
      return { deleted: 0, errors: [] }
    }

    console.log(`🗑️ Deleting ${productIds.length} products from database...`)

    try {
      // Process in batches to avoid overwhelming the database
      const batchSize = 50
      const batches = Math.ceil(productIds.length / batchSize)

      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize)
        const batchNum = Math.floor(i / batchSize) + 1

        console.log(`🗑️ BATCH ${batchNum}/${batches}: Deleting ${batch.length} products...`)

        try {
          const { error, count } = await this.supabase
            .from(this.getProductsTable())
            .delete()
            .in('id', batch)

          if (error) {
            const errorMsg = `❌ Batch ${batchNum} delete failed: ${error.message}`
            console.error(errorMsg)
            errors.push(errorMsg)
          } else {
            const deletedCount = count || batch.length
            deleted += deletedCount
            console.log(`   ✅ Batch ${batchNum} SUCCESS: ${deletedCount} products deleted`)
          }
        } catch (error) {
          const errorMsg = `❌ Batch ${batchNum} exception: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          errors.push(errorMsg)
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      console.log(`🗑️ Deletion completed: ${deleted} products deleted, ${errors.length} errors`)
      return { deleted, errors }

    } catch (error) {
      const errorMsg = `Failed to delete products: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error(errorMsg)
      errors.push(errorMsg)
      return { deleted, errors }
    }
  }

  // Method to update all existing products with latest data from WooCommerce
  async updateAllProductsData(): Promise<{updated: number, errors: string[]}> {
    if (!this.supabase) throw new Error('Database not connected')

    const errors: string[] = []
    let updated = 0

    try {
      console.log('⚡ OPTIMIZED UPDATE: Syncing essential meta fields only')
      console.log('🔄 UPDATING ALL PRODUCTS DATA FROM WOOCOMMERCE')
      console.log('='.repeat(60))
      console.log('📊 Sync scope: Title, SKU, Prices, Images, URLs, Platform Links & Prices')

      // Get all tool products
      const { data: toolProducts, error: toolError } = await this.supabase
        .from(this.getProductsTable())
        .select('id, website_id, title')
        .eq('project_id', this.currentProject!.project_id)

      if (toolError) {
        throw new Error(`Failed to get tool products: ${toolError.message}`)
      }

      if (!toolProducts || toolProducts.length === 0) {
        console.log('ℹ️ No products found in tool database')
        return { updated: 0, errors: [] }
      }

      console.log(`📊 Found ${toolProducts.length} products in tool database`)

      // Get all WooCommerce products
      const wooProducts = await this.getAllWooCommerceProducts()
      const wooProductsMap = new Map(
        wooProducts.map(p => [p.id.toString(), p])
      )

      console.log(`🛒 Fetched ${wooProducts.length} products from WooCommerce`)
      console.log('🔄 Updating product data...')

      // Process in batches
      const batchSize = 50
      const batches = Math.ceil(toolProducts.length / batchSize)

      for (let i = 0; i < toolProducts.length; i += batchSize) {
        const batch = toolProducts.slice(i, i + batchSize)
        const batchNum = Math.floor(i / batchSize) + 1

        console.log(`\n📦 BATCH ${batchNum}/${batches}: Processing ${batch.length} products...`)

        for (const toolProduct of batch) {
          const wooProduct = wooProductsMap.get(toolProduct.website_id)

          if (wooProduct) {
            try {
              // Map WooCommerce product to our format
              const updatedProductData = this.mapWooProductToProductData(wooProduct)

              // Update only essential meta fields for optimized sync
              const { error } = await this.supabase
                .from(this.getProductsTable())
                .update({
                  title: updatedProductData.title,
                  price: updatedProductData.price,
                  promotional_price: updatedProductData.promotional_price,
                  sku: updatedProductData.sku,
                  image_url: updatedProductData.image_url,
                  external_url: updatedProductData.external_url,
                  // currency: updatedProductData.currency, // Not in ProductDataDB type
                  // Stock status from meta_data
                  het_hang: updatedProductData.het_hang,
                  // Platform links and prices
                  link_shopee: updatedProductData.link_shopee,
                  gia_shopee: updatedProductData.gia_shopee,
                  link_tiktok: updatedProductData.link_tiktok,
                  gia_tiktok: updatedProductData.gia_tiktok,
                  link_lazada: updatedProductData.link_lazada,
                  gia_lazada: updatedProductData.gia_lazada,
                  link_dmx: updatedProductData.link_dmx,
                  gia_dmx: updatedProductData.gia_dmx,
                  link_tiki: updatedProductData.link_tiki,
                  gia_tiki: updatedProductData.gia_tiki,
                  updated_at: new Date().toISOString()
                  // Skip for performance: category, description
                })
                .eq('id', toolProduct.id)

              if (error) {
                const errorMsg = `Failed to update product ID ${toolProduct.id}: ${error.message}`
                errors.push(errorMsg)
                console.error(`   ❌ ${errorMsg}`)
              } else {
                updated++
                console.log(`   ✅ [${toolProduct.website_id}] ${toolProduct.title} - Updated successfully`)
              }
            } catch (error) {
              const errorMsg = `Exception updating product ID ${toolProduct.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
              errors.push(errorMsg)
              console.error(`   ❌ ${errorMsg}`)
            }
          } else {
            console.log(`   ⚠️ [${toolProduct.website_id}] ${toolProduct.title} - Not found on WooCommerce (will be handled separately)`)
          }
        }

        // Progress indicator
        const progress = Math.round(((i + batch.length) / toolProducts.length) * 100)
        console.log(`   📈 Progress: ${i + batch.length}/${toolProducts.length} (${progress}%)`)

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      console.log('\n' + '='.repeat(60))
      console.log('🎯 PRODUCT DATA UPDATE COMPLETED')
      console.log('='.repeat(60))
      console.log(`📊 Products processed: ${toolProducts.length}`)
      console.log(`✅ Successfully updated: ${updated}`)
      console.log(`❌ Errors: ${errors.length}`)

      if (errors.length > 0) {
        console.log('\n❌ ERRORS:')
        errors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`)
        })
      }

      return { updated, errors }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Product data update failed:', errorMsg)
      errors.push(errorMsg)
      return { updated, errors }
    }
  }

  // Comprehensive sync method that handles everything
  async comprehensiveProductSync(): Promise<{
    success: boolean
    message: string
    stats: {
      totalWooProducts: number
      totalToolProducts: number
      newProductsAdded: number
      productsUpdated: number
      productsDeleted: number
      errors: number
    }
    errors: string[]
  }> {
    if (!this.supabase) throw new Error('Database not connected')

    const errors: string[] = []
    const stats = {
      totalWooProducts: 0,
      totalToolProducts: 0,
      newProductsAdded: 0,
      productsUpdated: 0,
      productsDeleted: 0,
      errors: 0
    }

    try {
      console.log('🚀 COMPREHENSIVE PRODUCT SYNC STARTED')
      console.log('='.repeat(80))
      console.log('⏰ ' + new Date().toLocaleString('vi-VN'))
      console.log('🔧 Tool: UpdateLocknLock Comprehensive Sync')
      console.log('📍 Project:', this.currentProject?.name || 'No project')
      console.log('📋 Target table:', this.getProductsTable())
      console.log('🆔 Project ID:', this.currentProject?.project_id || 'No project ID')
      console.log('='.repeat(80))

      // Step 1: Get current state
      console.log('\n📊 STEP 1: Analyzing current state...')
      const toolProducts = await this.getToolProducts()
      const wooProducts = await this.getAllWooCommerceProducts()

      stats.totalToolProducts = toolProducts.length
      stats.totalWooProducts = wooProducts.length

      console.log(`📊 Current state:`)
      console.log(`   🔧 Tool database: ${stats.totalToolProducts} products`)
      console.log(`   🛒 WooCommerce: ${stats.totalWooProducts} products`)

      // Step 2: Find and delete products that no longer exist in WooCommerce
      console.log('\n🗑️ STEP 2: Finding products to delete...')
      const deletedProducts = await this.findDeletedProducts()

      if (deletedProducts.length > 0) {
        console.log(`🗑️ Found ${deletedProducts.length} products to delete:`)
        deletedProducts.forEach((product, index) => {
          console.log(`   ${index + 1}. [${product.website_id}] ${product.title}`)
        })

        const deleteResult = await this.deleteProductsFromDatabase(deletedProducts.map(p => p.id))
        stats.productsDeleted = deleteResult.deleted
        errors.push(...deleteResult.errors)
      } else {
        console.log('✅ No products need to be deleted')
      }

      // Step 3: Add new products from WooCommerce
      console.log('\n📥 STEP 3: Finding new products to add...')
      const missingProducts = await this.findMissingProducts(toolProducts, wooProducts)

      if (missingProducts.length > 0) {
        console.log(`📥 Found ${missingProducts.length} new products to add`)
        const addResult = await this.addMissingProducts(missingProducts)
        stats.newProductsAdded = addResult.success
        errors.push(...addResult.errors)
      } else {
        console.log('✅ No new products to add')
      }

      // Step 4: Update all existing products with latest data
      console.log('\n🔄 STEP 4: Updating existing products data...')
      const updateResult = await this.updateAllProductsData()
      stats.productsUpdated = updateResult.updated
      errors.push(...updateResult.errors)

      // Final statistics
      stats.errors = errors.length

      console.log('\n' + '='.repeat(80))
      console.log('🎯 COMPREHENSIVE SYNC COMPLETED')
      console.log('='.repeat(80))
      console.log(`📊 Final Results:`)
      console.log(`   🛒 WooCommerce products: ${stats.totalWooProducts}`)
      console.log(`   🔧 Tool products (before): ${stats.totalToolProducts}`)
      console.log(`   ➕ New products added: ${stats.newProductsAdded}`)
      console.log(`   🔄 Products updated: ${stats.productsUpdated}`)
      console.log(`   🗑️ Products deleted: ${stats.productsDeleted}`)
      console.log(`   ❌ Errors: ${stats.errors}`)
      console.log(`   🔧 Tool products (after): ${stats.totalToolProducts + stats.newProductsAdded - stats.productsDeleted}`)

      if (errors.length > 0) {
        console.log('\n❌ ERRORS ENCOUNTERED:')
        errors.forEach((error, index) => {
          console.error(`   ${index + 1}. ${error}`)
        })
      }

      const totalChanges = stats.newProductsAdded + stats.productsUpdated + stats.productsDeleted
      const message = totalChanges > 0
        ? `Comprehensive sync completed: ${stats.newProductsAdded} added, ${stats.productsUpdated} updated, ${stats.productsDeleted} deleted`
        : 'All products are already up to date'

      return {
        success: errors.length === 0,
        message,
        stats,
        errors
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ COMPREHENSIVE SYNC FAILED:', errorMsg)
      errors.push(errorMsg)
      stats.errors = errors.length

      return {
        success: false,
        message: `Comprehensive sync failed: ${errorMsg}`,
        stats,
        errors
      }
    }
  }
}

// Export convenience function
export async function syncMissingProducts(project?: Project): Promise<SyncReport> {
  const checker = new ProductSyncChecker(project)
  return await checker.checkAndSyncMissingProducts()
}

export async function checkMissingProducts(project?: Project): Promise<{missing: ProductDataDB[], report: Omit<SyncReport, 'newlyAdded' | 'errors'>}> {
  const checker = new ProductSyncChecker(project)
  return await checker.checkMissingProductsOnly()
}

export async function updateAllProductsStockStatus(project?: Project): Promise<{updated: number, errors: string[]}> {
  const checker = new ProductSyncChecker(project)
  return await checker.updateAllProductsStockStatus()
}

export async function updateStockStatusOnly(project?: Project): Promise<{
  success: boolean
  message: string
  wooStats: { inStock: number, outOfStock: number, total: number }
  finalStats: { inStock: number, outOfStock: number, total: number }
  updated: number
  errors: string[]
}> {
  const checker = new ProductSyncChecker(project)
  const result = await checker.updateStockStatusOnly()

  // Transform the response to match expected format
  return {
    success: result.success,
    message: result.message,
    wooStats: {
      inStock: result.beforeStats.instock,
      outOfStock: result.beforeStats.outofstock,
      total: result.beforeStats.total
    },
    finalStats: {
      inStock: result.afterStats.instock,
      outOfStock: result.afterStats.outofstock,
      total: result.afterStats.total
    },
    updated: result.updated,
    errors: result.errors
  }
}

export async function comprehensiveProductSync(project?: Project): Promise<{
  success: boolean
  message: string
  stats: {
    totalWooProducts: number
    totalToolProducts: number
    newProductsAdded: number
    productsUpdated: number
    productsDeleted: number
    errors: number
  }
  errors: string[]
}> {
  const checker = new ProductSyncChecker(project)
  return await checker.comprehensiveProductSync()
}