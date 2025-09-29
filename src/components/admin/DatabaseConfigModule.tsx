import React, { useState, useEffect } from 'react'
import { useSettingsService } from '../../services/settingsService'

interface DatabaseConfig {
  supabase_url: string
  supabase_anon_key: string
  // Table names are now hardcoded to products_new and product_updates for consistency
}

export default function DatabaseConfigModule() {
  const [config, setConfig] = useState<DatabaseConfig>({
    supabase_url: '',
    supabase_anon_key: ''
  })

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null)
  const [showSensitiveData, setShowSensitiveData] = useState(false)

  const settingsService = useSettingsService()

  useEffect(() => {
    // Add delay to ensure authentication is complete
    const initializeConfig = async () => {
      console.log('DatabaseConfigModule: Initializing...')
      await new Promise(resolve => setTimeout(resolve, 500))
      console.log('DatabaseConfigModule: Delay completed, loading config...')
      await loadCurrentConfig()
    }

    initializeConfig().catch(error => {
      console.error('DatabaseConfigModule: Initialization failed:', error)
      setLoading(false)
      setStatus({ type: 'error', message: `❌ Lỗi khởi tạo: ${error?.message || 'Unknown error'}` })
    })
  }, [])

  const loadCurrentConfig = async () => {
    console.log('DatabaseConfigModule: Starting loadCurrentConfig')
    setLoading(true)
    setStatus({ type: 'info', message: 'Loading database configuration...' })

    try {
      console.log('DatabaseConfigModule: Calling settingsService.getDatabaseConfig()')
      const dbConfig = await settingsService.getDatabaseConfig()
      console.log('DatabaseConfigModule: getDatabaseConfig result:', dbConfig ? 'Found config' : 'No config found')

      if (dbConfig) {
        setConfig(dbConfig)
        setStatus({ type: 'success', message: '✅ Cấu hình hiện tại đã được tải thành công' })
        console.log('DatabaseConfigModule: Configuration loaded successfully')
      } else {
        // No configuration found - this is normal for first time setup
        setConfig({
          supabase_url: '',
          supabase_anon_key: ''
        })
        setStatus({ type: 'info', message: '📝 Chưa có cấu hình - vui lòng nhập thông tin mới' })
        console.log('DatabaseConfigModule: No configuration found, using defaults')
      }
    } catch (error: any) {
      console.error('DatabaseConfigModule: Failed to load database config:', error)
      setStatus({ type: 'error', message: `❌ Lỗi tải cấu hình: ${error?.message || 'Unknown error'}` })
    } finally {
      console.log('DatabaseConfigModule: Finished loadCurrentConfig, setting loading to false')
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof DatabaseConfig, value: string) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    setStatus(null)
  }

  const validateConfig = (): boolean => {
    if (!config.supabase_url || !config.supabase_url.startsWith('https://')) {
      setStatus({ type: 'error', message: 'Supabase URL must be a valid HTTPS URL' })
      return false
    }

    if (!config.supabase_anon_key || config.supabase_anon_key.length < 100) {
      setStatus({ type: 'error', message: 'Supabase anon key appears to be invalid (too short)' })
      return false
    }

    // Table names are now hardcoded - no validation needed

    return true
  }

  const testConnection = async () => {
    if (!validateConfig()) return

    // Prevent concurrent connection tests
    if (saving) {
      console.log('Connection test already in progress, skipping...')
      return
    }

    setSaving(true)
    setStatus({ type: 'info', message: 'Testing database connection...' })

    try {
      const isValid = await settingsService.testDatabaseConnection(config)
      if (isValid) {
        setStatus({ type: 'success', message: '✅ Database connection successful!' })
      } else {
        setStatus({ type: 'error', message: '❌ Database connection failed - check your credentials and table name' })
      }
    } catch (error: any) {
      console.error('Connection test failed:', error)
      const errorMessage = error?.message || 'Unknown connection error'
      setStatus({ type: 'error', message: `❌ Connection test failed: ${errorMessage}` })
    } finally {
      setSaving(false)
    }
  }

  const saveConfig = async () => {
    if (!validateConfig()) return

    setSaving(true)
    setStatus({ type: 'info', message: 'Đang lưu cấu hình database...' })

    try {
      await settingsService.saveDatabaseConfig(config)
      setStatus({ type: 'success', message: '✅ Cấu hình database đã được lưu thành công!' })

      // Reload configuration to verify it was saved
      setTimeout(() => {
        loadCurrentConfig()
      }, 1000)

    } catch (error: any) {
      console.error('Failed to save database config:', error)
      setStatus({ type: 'error', message: `❌ Lỗi lưu cấu hình: ${error?.message || 'Unknown error'}` })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    setConfig({
      supabase_url: '',
      supabase_anon_key: ''
    })
    setStatus({ type: 'info', message: 'Reset to default values' })
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm border">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading configuration...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          🗄️ Database Configuration
        </h2>
        <p className="text-gray-600 mt-1">
          Configure Supabase database connection for all users
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Alert */}
        {status && (
          <div className={`p-4 rounded-lg ${
            status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {status.message}
          </div>
        )}

        {/* Supabase URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Supabase Project URL *
          </label>
          <input
            type="url"
            value={config.supabase_url}
            onChange={(e) => handleInputChange('supabase_url', e.target.value)}
            placeholder="https://your-project.supabase.co"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Found in Supabase Project Settings → API → Project URL
          </p>
        </div>

        {/* Supabase Anon Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Supabase Anon Key *
          </label>
          <div className="relative">
            <input
              type={showSensitiveData ? "text" : "password"}
              value={config.supabase_anon_key}
              onChange={(e) => handleInputChange('supabase_anon_key', e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSensitiveData(!showSensitiveData)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5"
            >
              {showSensitiveData ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Found in Supabase Project Settings → API → Project API keys → anon public
          </p>
        </div>

        {/* Table Names section removed - now hardcoded to products_new and product_updates for consistency */}
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
          <p className="text-sm text-blue-800">
            <strong>ℹ️ Table Configuration:</strong> Table names are now standardized to <code className="bg-blue-100 px-1 rounded">products_new</code> and <code className="bg-blue-100 px-1 rounded">product_updates</code> for consistency and project isolation.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t">
          <button
            onClick={testConnection}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? '⏳' : '🔍'} Test Connection
          </button>

          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? '⏳' : '💾'} Save Configuration
          </button>

          <button
            onClick={resetToDefaults}
            disabled={saving}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            🔄 Reset to Defaults
          </button>

          <button
            onClick={loadCurrentConfig}
            disabled={saving}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            📥 Reload Current
          </button>

          <button
            onClick={() => {
              console.log('=== DEBUG INFO ===')
              console.log('Current config:', config)
              console.log('Loading state:', loading)
              console.log('Saving state:', saving)
              console.log('Status:', status)
              console.log('=================')
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            🐛 Debug
          </button>
        </div>

        {/* Security Warning */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <span className="text-yellow-600">⚠️</span>
            <div>
              <h4 className="font-medium text-yellow-800">Security Notice</h4>
              <p className="text-sm text-yellow-700 mt-1">
                These credentials will be stored encrypted and only accessible by administrators.
                Changes will affect all users' database connections.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}