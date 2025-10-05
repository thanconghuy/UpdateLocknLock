import React, { useState, useRef } from 'react'
import type { SupabaseConfig, ProductData } from '../types'
import { supabase } from '../lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ENV, hasRequiredEnvVars } from '../config/env'

interface DatabaseUploaderProps {
  data?: ProductData[]
}

export default function DatabaseUploader({ data }: DatabaseUploaderProps) {
  const [status, setStatus] = useState<string | null>(null)
  const [table, setTable] = useState(ENV.DEFAULT_PRODUCTS_TABLE)
  const [auditTable, setAuditTable] = useState(ENV.DEFAULT_AUDIT_TABLE)
  const [auditEnabled, setAuditEnabled] = useState(true)
  const clientRef = useRef<SupabaseClient | null>(null)

  // Auto-connect on mount if env vars available
  React.useEffect(() => {
    if (hasRequiredEnvVars()) {
      clientRef.current = supabase
      setStatus('Ready to upload')
    }
  }, [])

  async function handleUpload() {
    if (!clientRef.current) {
      setStatus('Database not connected')
      return
    }

    const uploadData = data ?? []
    if (!uploadData || uploadData.length === 0) {
      setStatus('No data to upload')
      return
    }

    setStatus('Uploading...')
    try {
      const client = clientRef.current!
      const chunkSize = 200
      const total = uploadData.length
      let processed = 0

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = uploadData.slice(i, i + chunkSize)

        const payload = chunk.map((p, index) => {
          return {
            website_id: p.websiteId || `csv_${i + index + 1}_${Date.now()}`,
            sku: p.sku,
            title: p.title,
            price: p.price,
            promotional_price: p.promotionalPrice,
            external_url: p.externalUrl,
            category: p.category,
            image_url: p.imageUrl,
            currency: 'VND',
            link_shopee: p.linkShopee,
            gia_shopee: p.giaShopee,
            link_tiktok: p.linkTiktok,
            gia_tiktok: p.giaTiktok,
            link_lazada: p.linkLazada,
            gia_lazada: p.giaLazada,
            link_dmx: p.linkDmx,
            gia_dmx: p.giaDmx,
            link_tiki: p.linkTiki,
            gia_tiki: p.giaTiki,
          }
        })

        let attempt = 0
        const maxAttempts = 3
        while (attempt < maxAttempts) {
          attempt += 1
          const res = await client.from(table).upsert(payload, { onConflict: 'website_id' })
          
          if (res?.error) {
            console.warn(`chunk upsert error attempt ${attempt}`, res.error)
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, 500 * attempt))
              continue
            } else {
              throw res.error
            }
          }

          processed += payload.length
          setStatus(`Uploaded ${processed} / ${total} records`)
          break
        }
      }

      setStatus(`✅ Successfully uploaded ${processed} records`)
    } catch (err: any) {
      console.error(err)
      setStatus(`❌ Upload error: ${err?.message ?? String(err)}`)
    }
  }

  const isReady = hasRequiredEnvVars()
  const hasData = data && data.length > 0

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">Database Upload</h3>
        {isReady && (
          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
            ✓ Database Ready
          </span>
        )}
      </div>
      
      <div className="space-y-3">
        {status && (
          <div className="text-sm p-2 bg-gray-50 rounded">
            Status: {status}
          </div>
        )}
        
        <div className="flex gap-2">
          <button 
            className={`px-4 py-2 rounded font-medium ${
              isReady && hasData 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={handleUpload}
            disabled={!isReady || !hasData}
          >
            {hasData ? `Upload All (${data?.length} records)` : 'Upload All'}
          </button>
        </div>
        
        {!isReady && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ Database connection not configured. Check environment variables.
          </div>
        )}
        
        {!hasData && isReady && (
          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
            ℹ️ Upload CSV data first to enable database upload.
          </div>
        )}
      </div>
    </div>
  )
}