import React, { useMemo, useState, useEffect } from 'react'
import type { ProductData } from '../types'
import { createClient } from '@supabase/supabase-js'

interface Props {
  data: ProductData[]
}

const ALL_FIELDS = ['sku','title','description','price','currency','shopee','tiki','lazada','dmx','updated_at']

export default function ProductsPage({ data }: Props) {
  const [visibleFields, setVisibleFields] = useState<string[]>(ALL_FIELDS.slice(0,6))
  const [filter, setFilter] = useState<{ platform?: string, recentlyUpdated?: boolean }>({})
  const [dbRows, setDbRows] = useState<any[] | null>(null)
  const [loadingDb, setLoadingDb] = useState(false)
  const [dbStatus, setDbStatus] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
  const [editedProduct, setEditedProduct] = useState<any | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [priceAutoUpdated, setPriceAutoUpdated] = useState(false)
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())

  // ... (keep all existing functions and hooks) ...

  return (
    <div className="neo-card">
      {/* Top row: filters and counters */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Products ({rows.length} shown / {filteredRows.length} filtered / {dbRows?.length || 0} total)</h2>
        <div className="flex gap-2 items-center">
          <div className="filter-pill muted">Shopee: {platforms.shopee}</div>
          <div className="filter-pill muted">Tiki: {platforms.tiki}</div>
          <div className="filter-pill muted">Lazada: {platforms.lazada}</div>
          <div className="filter-pill muted">DMX: {platforms.dmx}</div>
        </div>
      </div>

      {/* Filter cards */}
      <div className="mb-4 flex gap-4">
        <div className="neo-card p-3">
          <h4 className="font-medium">Visible fields</h4>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ALL_FIELDS.map((f) => (
              <div key={f} className="field-toggle">
                <input id={`cb-${f}`} type="checkbox" checked={visibleFields.includes(f)} onChange={() => toggleField(f)} />
                <label htmlFor={`cb-${f}`} className="ml-2 capitalize text-sm">
                  {['shopee', 'tiki', 'lazada', 'dmx'].includes(f) 
                    ? `${f.charAt(0).toUpperCase() + f.slice(1)} (Link+Price)` 
                    : f.replace('_', ' ')
                  }
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="neo-card p-3">
          <h4 className="font-medium">Filters</h4>
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <button className={`px-3 py-1 ${filter.platform === 'shopee' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'shopee' ? undefined : 'shopee' }); setCurrentPage(1) }}>Shopee</button>
              <button className={`px-3 py-1 ${filter.platform === 'tiki' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'tiki' ? undefined : 'tiki' }); setCurrentPage(1) }}>Tiki</button>
              <button className={`px-3 py-1 ${filter.platform === 'lazada' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'lazada' ? undefined : 'lazada' }); setCurrentPage(1) }}>Lazada</button>
              <button className={`px-3 py-1 ${filter.platform === 'dmx' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => { setFilter({ ...filter, platform: filter.platform === 'dmx' ? undefined : 'dmx' }); setCurrentPage(1) }}>DMX</button>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="recently-updated" 
                checked={filter.recentlyUpdated || false}
                onChange={(e) => { setFilter({ ...filter, recentlyUpdated: e.target.checked || undefined }); setCurrentPage(1) }}
              />
              <label htmlFor="recently-updated" className="text-sm text-gray-700 cursor-pointer">
                Show only recently updated (last 24h)
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Main content: table and edit panel side by side */}
      <div className="flex gap-4">
        <div className={`transition-all duration-300 ${selectedProduct ? 'flex-1' : 'w-full'}`}>
          {/* Table controls */}
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <button className="neo-btn" onClick={() => fetchFromDb()} disabled={loadingDb}>
                {loadingDb ? 'Loading...' : 'Refresh from DB'}
              </button>
              {dbStatus && (
                <div className={`px-2 py-1 rounded text-sm ${dbStatus.includes('error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                  {dbStatus}
                </div>
              )}
              {!dbRows && !loadingDb && !dbStatus && (
                <div className="muted">Click "Refresh from DB" to load data</div>
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

          {/* Table */}
          <div className="overflow-auto">
            <table className="table-neo w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2 border">#</th>
                  {visibleFields.map(f => (
                    <th key={f} className={`p-2 border capitalize ${['shopee', 'tiki', 'lazada', 'dmx'].includes(f) ? 'min-w-32' : ''}`}>
                      {['shopee', 'tiki', 'lazada', 'dmx'].includes(f) 
                        ? `${f.charAt(0).toUpperCase() + f.slice(1)} (Link & Price)` 
                        : f.replace('_', ' ')
                      }
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
                    return (
                      <tr key={r?.id ?? (currentPage - 1) * pageSize + i + 1} className={`border-t transition-colors ${isRecentlyUpdated ? 'bg-green-50 border-green-200' : ''}`}>
                        <td className="p-2">{(currentPage - 1) * pageSize + i + 1}</td>
                        {visibleFields.map((f) => (
                          <td key={f} className={`p-2 ${['shopee', 'tiki', 'lazada', 'dmx'].includes(f) ? 'min-w-32' : ''}`}>
                            {(() => {
                              // Platform columns (shopee, tiki, lazada, dmx)
                              if (['shopee', 'tiki', 'lazada', 'dmx'].includes(f)) {
                                const linkField = `${f}_link`
                                const priceField = `${f}_price`
                                const link = r?.[linkField] || ''
                                const price = r?.[priceField] || 0
                                
                                if (!link && !price) {
                                  return <span className="muted">-</span>
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
                                          🔗 <span className="truncate">Link</span>
                                        </a>
                                      </div>
                                    )}
                                    {price > 0 && (
                                      <div className="text-green-700 font-semibold bg-green-50 px-1 py-0.5 rounded text-center">
                                        {new Intl.NumberFormat('vi-VN').format(price)}₫
                                      </div>
                                    )}
                                    {!link && !price && (
                                      <span className="text-gray-400 italic">No data</span>
                                    )}
                                  </div>
                                )
                              }
                              
                              // Regular fields
                              const value = r?.[f]
                              
                              if (f === 'price' && value > 0) {
                                return (
                                  <span className="font-medium text-green-600">
                                    {new Intl.NumberFormat('vi-VN').format(value)}₫
                                  </span>
                                )
                              }
                              
                              if (f === 'updated_at' && value) {
                                const date = new Date(value)
                                const isToday = date.toDateString() === new Date().toDateString()
                                const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                                const dateStr = isToday ? 'Today' : date.toLocaleDateString('vi-VN')
                                
                                return (
                                  <div className="text-xs">
                                    <div className={`font-medium ${isRecentlyUpdated ? 'text-green-700' : 'text-gray-700'}`}>
                                      {dateStr}
                                    </div>
                                    <div className={`${isRecentlyUpdated ? 'text-green-600' : 'text-gray-500'}`}>
                                      {timeStr}
                                      {isRecentlyUpdated && <span className="ml-1 text-green-600">✨ Just updated</span>}
                                    </div>
                                  </div>
                                )
                              }
                              
                              return value != null ? String(value) : (<span className="muted">-</span>)
                            })()}
                          </td>
                        ))}
                        <td className="p-2">
                          <button 
                            className="neo-btn text-xs px-2 py-1"
                            onClick={() => openEditSidebar(r)}
                          >
                            Edit
                          </button>
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
                        <span className="animate-spin">⏳</span> Updating
                      </span>
                    ) : hasChanges() ? (
                      <span className="flex items-center gap-1">
                        💾 Update
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
              {editedProduct && ALL_FIELDS.map((field) => (
                <div key={field} className={`p-3 rounded-lg border transition-all ${isFieldChanged(field) ? 'bg-yellow-50 border-yellow-300 shadow-sm' : 'bg-gray-50 border-gray-200'}`}>
                  <label className={`block text-sm font-medium mb-2 capitalize ${isFieldChanged(field) ? 'text-yellow-800' : 'text-gray-700'}`}>
                    <span className="flex items-center gap-2">
                      {field.replace('_', ' ')}
                      {isFieldChanged(field) && <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">Modified</span>}
                    </span>
                  </label>
                  
                  {/* Platform fields (shopee, tiki, lazada, dmx) */}
                  {['shopee', 'tiki', 'lazada', 'dmx'].includes(field) ? (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Link</label>
                        <input
                          type="url"
                          className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          value={editedProduct[`${field}_link`] || ''}
                          onChange={(e) => handleFieldChange(`${field}_link`, e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Price (₫)</label>
                        <input
                          type="number"
                          step="1"
                          className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                          value={editedProduct[`${field}_price`] || ''}
                          onChange={(e) => handleFieldChange(`${field}_price`, parseInt(e.target.value) || 0)}
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
                !key.endsWith('_link') && !key.endsWith('_price') // Exclude platform fields already handled above
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
        )}
      </div>
    </div>
  )
}
