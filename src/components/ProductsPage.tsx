import React, { useMemo, useState, useEffect } from 'react'
import type { ProductData } from '../types'
import { createClient } from '@supabase/supabase-js'
import { applyAutoUpdateIfNeeded, shouldAutoUpdatePrice } from '../utils/priceAutoUpdater'
import { useStore } from '../store/useStore'

interface Props {
  data: ProductData[]
}

const ALL_FIELDS = [
  'title', 'website_id', 'sku', 'price', 'promotional_price', 
  'image_url',
  'shopee', 'tiktok', 'lazada', 'dmx', 'tiki', // Combined brand columns
  'external_url', 'currency'
]

// Platform fields that should be excluded from additional fields section
const PLATFORM_FIELDS = [
  'link_shopee', 'gia_shopee', 'shopee_link', 'shopee_price',
  'link_tiktok', 'gia_tiktok', 'tiktok_link', 'tiktok_price',
  'link_lazada', 'gia_lazada', 'lazada_link', 'lazada_price',
  'link_dmx', 'gia_dmx', 'dmx_link', 'dmx_price',
  'link_tiki', 'gia_tiki', 'tiki_link', 'tiki_price'
]

export default function ProductsPage({ data }: Props) {
  const { updateProductInWooCommerce, syncProductFromWooCommerce } = useStore()
  const [visibleFields, setVisibleFields] = useState<string[]>(ALL_FIELDS.filter(f => f !== 'updated_at'))
  const [filter, setFilter] = useState<{ platform?: string, recentlyUpdated?: boolean, timeFilter?: string }>({})
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [dbRows, setDbRows] = useState<any[] | null>(null)
  const [loadingDb, setLoadingDb] = useState(false)
  const [dbStatus, setDbStatus] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [editedProduct, setEditedProduct] = useState<any | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [priceAutoUpdated, setPriceAutoUpdated] = useState(false)
  const [autoUpdateSummary, setAutoUpdateSummary] = useState<string>('')
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())
  const [syncingProducts, setSyncingProducts] = useState<Set<string>>(new Set())

  console.log('ProductsPage data:', data)
  console.log('Data length:', data.length)
  console.log('DB rows:', dbRows)

  const platforms = useMemo(() => {
    const stats: Record<string, number> = { shopee:0, tiktok:0, lazada:0, dmx:0, tiki:0 }
    if (dbRows) {
      dbRows.forEach((d) => {
        if (d.link_shopee) stats.shopee++
        if (d.link_tiktok) stats.tiktok++
        if (d.link_lazada) stats.lazada++
        if (d.link_dmx) stats.dmx++
        if (d.link_tiki) stats.tiki++
      })
    }
    return stats
  }, [dbRows])

  const filteredRows = useMemo(() => {
    const base = dbRows || []
    console.log('Base data:', base)
    console.log('Filter:', filter)
    console.log('Search query:', searchQuery)
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
    setLoadingDb(true)
    setDbStatus(null)
    try {
      const url = localStorage.getItem('supabase:url')
      const key = localStorage.getItem('supabase:key')
      const table = localStorage.getItem('supabase:table') || 'products'
      console.log('DB credentials:', { url: !!url, key: !!key, table })
      if (!url || !key) {
        setDbStatus('no saved supabase credentials')
        setLoadingDb(false)
        return
      }
      const supa = createClient(url, key)
      console.log('Fetching from table:', table)
      const { data: d, error } = await supa.from(table).select('*').limit(1000)
      console.log('DB response:', { data: d, error })
      if (error) {
        setDbStatus(`db error: ${error.message}`)
        setDbRows([])
      } else {
        setDbRows(d || [])
        setDbStatus(`loaded ${d?.length ?? 0} rows`)
        console.log('Set dbRows to:', d)
      }
    } catch (err: any) {
      console.error('DB fetch error:', err)
      setDbStatus(`fetch error: ${err?.message ?? String(err)}`)
      setDbRows([])
    } finally {
      setLoadingDb(false)
    }
  }

  // Auto-load data on mount
  useEffect(() => {
    if (!dbRows && !loadingDb) {
      fetchFromDb()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      const url = localStorage.getItem('supabase:url')
      const key = localStorage.getItem('supabase:key')
      const table = localStorage.getItem('supabase:table') || 'products'
      
      if (!url || !key) {
        setDbStatus('No Supabase credentials')
        setIsUpdating(false)
        return
      }

      if (!editedProduct.id) {
        setDbStatus('Product ID is missing')
        setIsUpdating(false)
        return
      }

      const supa = createClient(url, key)
      console.log('Sending update to Supabase:', { table, id: editedProduct.id, data: editedProduct })
      
      // First, verify the product exists
      const { data: existingProduct, error: checkError } = await supa
        .from(table)
        .select('id, sku')
        .eq('id', editedProduct.id)
        .single()
      
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

      // Update the product
      const { error, data: updateResult } = await supa
        .from(table)
        .update(updateData)
        .eq('id', editedProduct.id)
        .select() // Return updated data

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
          const { error: auditError } = await supa
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
            giaTiki: editedProduct.gia_tiki || 0
          }

          const wooSuccess = await updateProductInWooCommerce(productData)
          
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
      const syncedData = await syncProductFromWooCommerce(product.website_id, product.id)
      
      if (syncedData) {
        // Update local database with synced data
        const url = localStorage.getItem('supabase:url')
        const key = localStorage.getItem('supabase:key')
        const table = localStorage.getItem('supabase:table') || 'products'
        
        if (url && key) {
          const supa = createClient(url, key)
          
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
          
          const { error } = await supa
            .from(table)
            .update(updateData)
            .eq('id', product.id)
          
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

  return (
    <div className="neo-card">
      {/* Top row: filters and counters */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Products ({rows.length} shown / {filteredRows.length} filtered / {dbRows?.length || 0} total)</h2>
        <div className="flex gap-2 items-center">
          <div className="filter-pill muted">Shopee: {platforms.shopee}</div>
          <div className="filter-pill muted">TikTok: {platforms.tiktok}</div>
          <div className="filter-pill muted">Tiki: {platforms.tiki}</div>
          <div className="filter-pill muted">Lazada: {platforms.lazada}</div>
          <div className="filter-pill muted">DMX: {platforms.dmx}</div>
          {recentlyUpdated.size > 0 && (
            <div className="filter-pill bg-green-100 text-green-700 border-green-200">
              ✨ Recently updated: {recentlyUpdated.size}
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
                      'currency': 'Tiền tệ'
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
            <div className="flex gap-2 flex-wrap">
              <button className={`px-3 py-1 ${filter.platform === 'shopee' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'shopee' ? undefined : 'shopee' }); setCurrentPage(1) }}>Shopee</button>
              <button className={`px-3 py-1 ${filter.platform === 'tiktok' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'tiktok' ? undefined : 'tiktok' }); setCurrentPage(1) }}>TikTok</button>
              <button className={`px-3 py-1 ${filter.platform === 'tiki' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'tiki' ? undefined : 'tiki' }); setCurrentPage(1) }}>Tiki</button>
              <button className={`px-3 py-1 ${filter.platform === 'lazada' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'lazada' ? undefined : 'lazada' }); setCurrentPage(1) }}>Lazada</button>
              <button className={`px-3 py-1 ${filter.platform === 'dmx' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'dmx' ? undefined : 'dmx' }); setCurrentPage(1) }}>DMX</button>
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
            {loadingDb ? 'Loading...' : 'Refresh from DB'}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {dbStatus && (
            <div className={`px-2 py-1 rounded text-sm ${dbStatus.includes('error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
              {dbStatus}
            </div>
          )}
          {!dbRows && !loadingDb && !dbStatus && (
            <div className="muted">Click "Refresh from DB" to load data</div>
          )}
          {searchQuery && (
            <div className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
              🔍 Searching: "{searchQuery}" ({filteredRows.length} found)
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
      <div className="flex gap-4">
        <div className={`transition-all duration-300 ${selectedProduct ? 'flex-1' : 'w-full'}`}>
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
                          'currency': 'Tiền tệ'
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
                console.log(`Row ${i}:`, r)
                console.log(`Available keys:`, Object.keys(r || {}))
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
                  <tr key={r?.id ?? (currentPage - 1) * pageSize + i + 1} className={rowClasses}>
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
                          console.log(`Looking for field "${f}" in row:`, r)
                          
                          // Handle combined brand columns (shopee, tiktok, lazada, dmx, tiki)
                          if (['shopee', 'tiktok', 'lazada', 'dmx', 'tiki'].includes(f)) {
                            const linkField = `link_${f}` 
                            const priceField = `gia_${f}`
                            const link = r?.[linkField] || ''
                            const price = r?.[priceField] || 0
                            
                            
                            if (!link && !price) {
                              return <span className="text-gray-400 text-xs">-</span>
                            }
                            
                            return (
                              <div className="text-xs space-y-1 min-w-0">
                                {link && (
                                  <div className="truncate">
                                    <a 
                                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline" 
                                      href={link} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      title={link}
                                    >
                                      🔗 <span className="truncate text-xs">
                                        {f === 'dmx' ? 'DMX' : f === 'tiki' ? 'Tiki' : f.charAt(0).toUpperCase() + f.slice(1)}
                                      </span>
                                    </a>
                                  </div>
                                )}
                                {price > 0 && (
                                  <div className="text-green-700 font-semibold bg-green-50 px-1 py-0.5 rounded text-center text-xs">
                                    {new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price)}₫
                                  </div>
                                )}
                              </div>
                            )
                          }

                          // Handle title field (add product link)
                          if (f === 'title') {
                            const productUrl = r?.website_id ? `https://locknlockvietnam.com/shop/?p=${r.website_id}` : null
                            return (
                              <div className="space-y-1">
                                <div className="font-medium">
                                  {productUrl ? (
                                    <a 
                                      href={productUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {r?.title || 'Untitled'}
                                    </a>
                                  ) : (
                                    <span>{r?.title || 'Untitled'}</span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500">
                                  ID: {r?.website_id || 'N/A'}
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
                          console.log(`Field "${f}" value:`, value)
                          
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
                )
              })
            )}
          </tbody>
        </table>
      </div>
        </div>

        {/* Inline Edit Panel */}
        {selectedProduct && (
          <div className="w-96 bg-white border-l shadow-lg">
            {/* Header */}
            <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-800">Edit Product</h3>
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
                      '✅'
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
              <div className={`text-xs transition-colors ${hasChanges() ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                {hasChanges() ? '📝 Changes detected - ready to save!' : '✅ Up to date'}
              </div>
              
              {/* Auto-update summary */}
              {priceAutoUpdated && autoUpdateSummary && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <div className="font-medium text-blue-800 mb-1">🤖 Tự động cập nhật giá:</div>
                  <div className="text-blue-700 whitespace-pre-line">
                    {autoUpdateSummary}
                  </div>
                </div>
              )}
              <div className="text-xs text-gray-600 mt-1">
                <div className="flex items-center justify-between">
                  <span>SKU: {editedProduct?.sku || 'N/A'}</span>
                  <span>ID: {editedProduct?.id || 'N/A'}</span>
                </div>
                {recentlyUpdated.has(String(editedProduct?.id)) && (
                  <div className="mt-1 text-green-600 font-medium text-xs">
                    ✨ Recently updated
                  </div>
                )}
              </div>
            </div>
            
            {/* Scrollable Content */}
            <div className="p-4 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
              <div className="space-y-4">
              {editedProduct && ALL_FIELDS.map((field) => (
                <div key={field} className={`p-3 rounded-lg border transition-all ${isFieldChanged(field) ? 'bg-yellow-50 border-yellow-300 shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
                  <label className={`block text-sm font-medium mb-2 capitalize ${isFieldChanged(field) ? 'text-yellow-800' : 'text-gray-700'}`}>
                    <span className="flex items-center gap-2">
                      {field.replace('_', ' ')}
                      {isFieldChanged(field) && <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">Modified</span>}
                    </span>
                  </label>
                  
                  {/* Handle platform fields (shopee, tiktok, tiki, lazada, dmx) */}
                  {['shopee', 'tiktok', 'tiki', 'lazada', 'dmx'].includes(field) ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Link</label>
                        <input
                          type="url"
                          className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          value={editedProduct[`link_${field}`] || ''}
                          onChange={(e) => handleFieldChange(`link_${field}`, e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Price (₫)</label>
                        <input
                          type="number"
                          step="1"
                          className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          value={editedProduct[`gia_${field}`] || ''}
                          onChange={(e) => handleFieldChange(`gia_${field}`, parseInt(e.target.value) || 0)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  ) : field === 'description' ? (
                    <textarea
                      className="w-full p-2 border rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      rows={3}
                      value={editedProduct[field] || ''}
                      onChange={(e) => handleFieldChange(field, e.target.value)}
                      placeholder="Product description..."
                    />
                  ) : field === 'price' ? (
                    <div>
                      <input
                        type="number"
                        step="1"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        value={editedProduct[field] || ''}
                        onChange={(e) => handleFieldChange(field, parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                      <div className={`text-xs mt-1 transition-colors ${priceAutoUpdated ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                        {priceAutoUpdated ? '✅ Price auto-updated!' : '💡 Auto-updates to minimum platform price'}
                      </div>
                    </div>
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
              
              {/* Additional fields that might exist in the database */}
              {editedProduct && Object.keys(editedProduct).filter(key => 
                !ALL_FIELDS.includes(key) && 
                !['id', 'created_at', 'updated_at', 'raw', 'meta'].includes(key) &&
                !PLATFORM_FIELDS.includes(key) // Exclude all platform fields
              ).map((field) => (
                <div key={field} className={`p-3 rounded-lg border transition-all ${isFieldChanged(field) ? 'bg-yellow-50 border-yellow-300 shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
                  <label className={`block text-sm font-medium mb-2 capitalize ${isFieldChanged(field) ? 'text-yellow-800' : 'text-gray-700'}`}>
                    <span className="flex items-center gap-2">
                      {field.replace('_', ' ')}
                      {isFieldChanged(field) && <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">Modified</span>}
                    </span>
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
          </div>
        )}
      </div>
    </div>
  )
}