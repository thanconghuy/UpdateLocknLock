import React, { useState, useRef } from 'react'
import type { SupabaseConfig, ProductData } from '../types'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { detectPlatformLinks } from '../utils/links'
import { ENV, hasRequiredEnvVars, isProductionMode } from '../config/env'

interface SupabaseConnectorProps {
  onConnect: (config: SupabaseConfig) => void
  onUpload?: (data: ProductData[]) => Promise<void>
  data?: ProductData[]
}

export default function SupabaseConnector({ onConnect, onUpload, data }: SupabaseConnectorProps) {
  const [url, setUrl] = useState(ENV.SUPABASE_URL)
  const [key, setKey] = useState(ENV.SUPABASE_ANON_KEY)
  const [status, setStatus] = useState<string | null>(null)
  const [table, setTable] = useState(ENV.DEFAULT_PRODUCTS_TABLE)
  const [auditTable, setAuditTable] = useState(ENV.DEFAULT_AUDIT_TABLE)
  const [auditEnabled, setAuditEnabled] = useState(true)
  const [showCredentials, setShowCredentials] = useState(false)
  // cache the client so we only create/connect once per session
  const clientRef = useRef<SupabaseClient | null>(null)

  async function handleConnect() {
    if (!url || !key) {
      setStatus('missing url/key')
      return
    }

    if (!clientRef.current) {
      try {
        const client = createClient(url, key)
        clientRef.current = client
        onConnect({ url, key })
        // persist credentials locally (browser)
        try {
          localStorage.setItem('supabase:url', url)
          localStorage.setItem('supabase:key', key)
          localStorage.setItem('supabase:table', table)
          localStorage.setItem('supabase:audit_table', auditTable)
          localStorage.setItem('supabase:audit_enabled', String(auditEnabled))
        } catch (err) {
          console.warn('localStorage not available', err)
        }
        setStatus('connected (client created)')

        // perform a lightweight test: attempt a select on provided table
        try {
          const res = await client.from(table).select('id').limit(1)
          // supabase-js returns { data, error }
          // @ts-ignore
          if (res?.error) {
            setStatus(`connected (warning: ${res.error.message})`)
          } else {
            setStatus('connected (ok)')
          }
        } catch (err) {
          setStatus('connected (test failed)')
          console.error('connection test error', err)
        }
      } catch (err) {
        console.error(err)
        setStatus('error creating client')
      }
    } else {
      setStatus('already connected')
    }
  }

  async function handleUpload() {
    if (!clientRef.current) {
      setStatus('not connected')
      return
    }

    const uploadData = data ?? []
    if (!uploadData || uploadData.length === 0) {
      setStatus('no data to upload')
      return
    }

    setStatus('uploading')
    try {
      const client = clientRef.current!
      const chunkSize = 200
      const total = uploadData.length
      let processed = 0

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = uploadData.slice(i, i + chunkSize)

        // map ProductData -> DB row payload (removing raw/meta fields)
        const payload = chunk.map((p, index) => {
          return {
            // Don't include id - let database auto-generate it
            website_id: p.websiteId || `csv_${i + index + 1}_${Date.now()}`, // Ensure website_id is never null
            sku: p.sku,
            title: p.title,
            price: p.price,
            promotional_price: p.promotionalPrice,
            external_url: p.externalUrl,
            category: p.category,
            image_url: p.imageUrl,
            currency: 'VND',
            // Platform data
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

        // retry per chunk
        let attempt = 0
        const maxAttempts = 3
        while (attempt < maxAttempts) {
          attempt += 1
          const res = await client.from(table).upsert(payload, { onConflict: 'website_id' })
          // supabase-js returns different shapes; check for error
          // @ts-ignore
          if (res?.error) {
            console.warn(`chunk upsert error attempt ${attempt}`, res.error)
            if (attempt < maxAttempts) {
              await new Promise((r) => setTimeout(r, 500 * attempt))
              continue
            } else {
              throw res.error
            }
          }

          // success for this chunk
          processed += payload.length
          setStatus(`uploaded ${processed} / ${total}`)
          break
        }
      }

      setStatus(`done: uploaded ${processed} rows`)
      if (onUpload) await onUpload(uploadData)
    } catch (err: any) {
      console.error(err)
      setStatus(`upload error: ${err?.message ?? String(err)}`)
    }
  }

  // load saved creds on mount and auto-connect if env vars available
  React.useEffect(() => {
    try {
      const su = localStorage.getItem('supabase:url')
      const sk = localStorage.getItem('supabase:key')
      const st = localStorage.getItem('supabase:table')
      const sat = localStorage.getItem('supabase:audit_table')
      const sae = localStorage.getItem('supabase:audit_enabled')
      if (su) setUrl(su)
      if (sk) setKey(sk)
      if (st) setTable(st)
      if (sat) setAuditTable(sat)
      if (sae !== null) setAuditEnabled(sae === 'true')
    } catch (err) {
      // ignore
    }

    // Auto-connect if environment variables are configured
    if (hasRequiredEnvVars()) {
      setTimeout(() => {
        handleConnect()
      }, 500)
    }
  }, [])

  function clearSaved() {
    try {
      localStorage.removeItem('supabase:url')
      localStorage.removeItem('supabase:key')
      localStorage.removeItem('supabase:table')
      localStorage.removeItem('supabase:audit_table')
      localStorage.removeItem('supabase:audit_enabled')
      setUrl('')
      setKey('')
      setTable('products')
      setAuditTable('product_updates')
      setAuditEnabled(true)
      setStatus('cleared saved credentials')
    } catch (err) {
      console.warn('localStorage not available', err)
    }
  }

  const maskValue = (value: string) => {
    if (!value || value.length <= 8) return value
    return value.slice(0, 4) + '***' + value.slice(-4)
  }

  const isConfiguredFromEnv = hasRequiredEnvVars()

  // Hide entire component when configured from environment in production
  if (isConfiguredFromEnv && isProductionMode()) {
    return null
  }

  return (
    <div className="bg-white rounded p-4 shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Supabase</h3>
        {isConfiguredFromEnv && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              ✓ Auto-configured and Connected
            </span>
            <button 
              className="text-xs text-blue-600 underline"
              onClick={() => setShowCredentials(!showCredentials)}
            >
              {showCredentials ? 'Hide' : 'Show'} Config
            </button>
          </div>
        )}
      </div>
      
      <div className="mt-2 grid grid-cols-1 gap-2">
        {(!isConfiguredFromEnv || showCredentials) && (
          <>
            <input 
              className="p-2 border" 
              placeholder="Supabase URL" 
              type={isProductionMode() && !showCredentials ? "password" : "text"}
              value={isProductionMode() && !showCredentials ? maskValue(url) : url} 
              onChange={(e) => setUrl(e.target.value)}
              disabled={isConfiguredFromEnv && isProductionMode()}
            />
            <input 
              className="p-2 border" 
              placeholder="Supabase API Key" 
              type={isProductionMode() && !showCredentials ? "password" : "text"}
              value={isProductionMode() && !showCredentials ? maskValue(key) : key} 
              onChange={(e) => setKey(e.target.value)}
              disabled={isConfiguredFromEnv && isProductionMode()}
            />
          </>
        )}
        
        <input 
          className="p-2 border" 
          placeholder="Table name (e.g. products)" 
          value={table} 
          onChange={(e) => setTable(e.target.value)} 
        />
        <input 
          className="p-2 border" 
          placeholder="Audit table (e.g. product_updates)" 
          value={auditTable} 
          onChange={(e) => setAuditTable(e.target.value)} 
        />
        <div className="flex items-center gap-2 p-2 border rounded">
          <input 
            type="checkbox" 
            id="audit-enabled" 
            checked={auditEnabled} 
            onChange={(e) => setAuditEnabled(e.target.checked)} 
          />
          <label htmlFor="audit-enabled" className="text-sm">Enable audit logging</label>
        </div>
        <div className="flex gap-2">
          {!isConfiguredFromEnv && (
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={handleConnect}>Connect</button>
          )}
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={handleUpload}>Upload All</button>
          {!isProductionMode() && (
            <button className="px-3 py-1 border text-sm" onClick={clearSaved}>Clear saved</button>
          )}
        </div>
        {status && <div className="mt-2 text-sm">Status: {status}</div>}
        
        {isConfiguredFromEnv && (
          <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
            ℹ️ Credentials are loaded from environment variables for security.
          </div>
        )}
      </div>
    </div>
  )
}
