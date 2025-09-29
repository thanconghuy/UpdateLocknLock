import React, { useState, useRef } from 'react'
import type { SupabaseConfig, ProductData } from '../types'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { detectPlatformLinks } from '../utils/links'
import { ENV, hasRequiredEnvVars, isProductionMode } from '../config/env'
import { useSettingsService } from '../services/settingsService'

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
  const [isConnecting, setIsConnecting] = useState(false)
  // cache the client so we only create/connect once per session
  const clientRef = useRef<SupabaseClient | null>(null)
  const connectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const settingsService = useSettingsService()

  async function handleConnect() {
    // Prevent concurrent connection attempts
    if (isConnecting) {
      console.log('Connection already in progress, skipping...')
      return
    }

    if (!url || !key) {
      setStatus('❌ Missing URL or key')
      return
    }

    if (clientRef.current) {
      setStatus('✅ Already connected')
      return
    }

    setIsConnecting(true)
    setStatus('🔄 Connecting to database...')

    // Clear any existing timeout
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current)
      connectTimeoutRef.current = null
    }

    try {
      // Create client with timeout protection
      const client = createClient(url, key, {
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'X-Client-Info': 'locknlock-update-tool'
          }
        }
      })

      // Test connection with timeout
      const connectionTest = new Promise(async (resolve, reject) => {
        try {
          setStatus('🔍 Testing database connection...')

          // Test with a simple query
          const { data, error } = await client.from(table).select('id').limit(1)

          if (error) {
            reject(new Error(`Database test failed: ${error.message}`))
          } else {
            resolve({ success: true, data })
          }
        } catch (error) {
          reject(error)
        }
      })

      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        connectTimeoutRef.current = setTimeout(() => {
          reject(new Error('Connection timeout after 10 seconds'))
        }, 10000)
      })

      // Race between connection test and timeout
      await Promise.race([connectionTest, timeoutPromise])

      // Clear timeout on success
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }

      // Connection successful
      clientRef.current = client
      onConnect({ url, key })

      // Persist credentials locally
      try {
        localStorage.setItem('supabase:url', url)
        localStorage.setItem('supabase:key', key)
        localStorage.setItem('supabase:table', table)
        localStorage.setItem('supabase:audit_table', auditTable)
        localStorage.setItem('supabase:audit_enabled', String(auditEnabled))
      } catch (err) {
        console.warn('localStorage not available', err)
      }

      setStatus('✅ Connected successfully')

    } catch (error: any) {
      console.error('Connection error:', error)

      // Clear timeout on error
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }

      // Reset client on error
      clientRef.current = null

      const errorMessage = error?.message || 'Unknown connection error'
      setStatus(`❌ Connection failed: ${errorMessage}`)

    } finally {
      setIsConnecting(false)
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

  // Load saved credentials and auto-connect with proper error handling
  React.useEffect(() => {
    let mounted = true

    const initializeConnection = async () => {
      try {
        // Try to load admin settings first (higher priority)
        try {
          const adminConfig = await settingsService.getDatabaseConfig()
          if (adminConfig) {
            console.log('✅ Using admin settings for database config')
            setUrl(adminConfig.supabase_url)
            setKey(adminConfig.supabase_anon_key)
            setTable('products_new') // Hardcoded for consistency
            setAuditTable('product_updates') // Hardcoded for consistency
            setStatus('🔧 Sử dụng cấu hình từ Admin Settings')
          } else {
            console.log('ℹ️ No admin config found, using local/env config')
          }
        } catch (error) {
          console.warn('Could not load admin config, fallback to local:', error)
        }

        // Load saved credentials as fallback (if no admin config)
        const su = localStorage.getItem('supabase:url')
        const sk = localStorage.getItem('supabase:key')
        const st = localStorage.getItem('supabase:table')
        const sat = localStorage.getItem('supabase:audit_table')
        const sae = localStorage.getItem('supabase:audit_enabled')

        if (su && !url) setUrl(su)
        if (sk && !key) setKey(sk)
        if (st && !table) setTable(st)
        if (sat && !auditTable) setAuditTable(sat)
        if (sae !== null) setAuditEnabled(sae === 'true')

        // Auto-connect if environment variables are configured
        if (hasRequiredEnvVars() && mounted) {
          setStatus('⏳ Auto-connecting with environment variables...')

          // Add small delay to ensure state is updated
          await new Promise(resolve => setTimeout(resolve, 100))

          if (mounted) {
            await handleConnect()
          }
        } else if (mounted) {
          setStatus('⚠️ Database not configured - check environment variables')
        }
      } catch (err) {
        console.warn('Failed to initialize connection:', err)
        if (mounted) {
          setStatus('❌ Failed to initialize connection')
        }
      }
    }

    initializeConnection()

    // Cleanup function
    return () => {
      mounted = false
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current)
        connectTimeoutRef.current = null
      }
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
  const hasAdminConfig = url && key && status?.includes('Admin Settings')

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
        {hasAdminConfig && !isConfiguredFromEnv && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
              🔧 Admin Configuration
            </span>
            <button
              className="text-xs text-blue-600 underline"
              onClick={() => setShowCredentials(!showCredentials)}
            >
              {showCredentials ? 'Hide' : 'Show'} Details
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
            <button
              className={`px-3 py-1 text-white rounded ${isConnecting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? '⏳ Connecting...' : 'Connect'}
            </button>
          )}
          <button
            className={`px-3 py-1 text-white rounded ${(!clientRef.current && !isConfiguredFromEnv) ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
            onClick={handleUpload}
            disabled={!clientRef.current && !isConfiguredFromEnv}
          >
            Upload All
          </button>
          {!isProductionMode() && (
            <button
              className="px-3 py-1 border text-sm hover:bg-gray-50"
              onClick={clearSaved}
              disabled={isConnecting}
            >
              Clear saved
            </button>
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
