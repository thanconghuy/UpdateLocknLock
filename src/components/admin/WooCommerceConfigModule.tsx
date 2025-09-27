import React, { useState, useEffect } from 'react'
import { WooCommerceConfigService, WooCommerceConfig } from '../../services/wooCommerceConfigService'

export default function WooCommerceConfigModule() {
  const [config, setConfig] = useState<WooCommerceConfig>({
    consumer_key: '',
    consumer_secret: '',
    version: 'wc/v3',
    timeout: 10000
  })

  // Test URL riêng biệt (không lưu vào config chung)
  const [testBaseUrl, setTestBaseUrl] = useState('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{type: 'success' | 'error' | 'info', message: string} | null>(null)
  const [showSensitiveData, setShowSensitiveData] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)

  useEffect(() => {
    // Add delay to ensure authentication is complete
    const initializeConfig = async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await loadCurrentConfig()
    }

    initializeConfig()
  }, [])

  const loadCurrentConfig = async () => {
    if (loading) {
      console.log('⚠️ Load already in progress, skipping...')
      return
    }

    setLoading(true)
    setStatus({ type: 'info', message: 'Đang tải cấu hình WooCommerce...' })

    try {
      console.log('🔄 Loading WooCommerce config...')
      const wooConfig = await WooCommerceConfigService.getWooCommerceConfig()

      if (wooConfig) {
        setConfig(wooConfig)
        setStatus({ type: 'success', message: '✅ Cấu hình WooCommerce đã được tải' })
        console.log('✅ WooCommerce config loaded successfully')
      } else {
        setConfig({
          consumer_key: '',
          consumer_secret: '',
          version: 'wc/v3',
          timeout: 10000
        })
        setStatus({ type: 'info', message: 'ℹ️ Chưa có cấu hình WooCommerce. Hãy cấu hình Consumer Key và Secret.' })
        console.log('ℹ️ No WooCommerce config found')
      }
    } catch (error: any) {
      console.error('❌ Failed to load WooCommerce config:', error)
      setStatus({ type: 'error', message: `❌ Lỗi tải cấu hình: ${error?.message || 'Unknown error'}` })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof WooCommerceConfig, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    setStatus(null)
    setTestResults(null)
  }

  const validateConfig = (): boolean => {
    if (!config.consumer_key || config.consumer_key.length < 10) {
      setStatus({ type: 'error', message: '❌ Consumer Key không hợp lệ (cần ít nhất 10 ký tự)' })
      return false
    }

    if (!config.consumer_secret || config.consumer_secret.length < 10) {
      setStatus({ type: 'error', message: '❌ Consumer Secret không hợp lệ (cần ít nhất 10 ký tự)' })
      return false
    }

    if ((config.timeout || 0) < 5000 || (config.timeout || 0) > 120000) {
      setStatus({ type: 'error', message: '❌ Timeout phải từ 5-120 giây' })
      return false
    }

    return true
  }

  const validateTestUrl = (): boolean => {
    if (!testBaseUrl || !testBaseUrl.startsWith('http')) {
      setStatus({ type: 'error', message: '❌ URL test phải là HTTP/HTTPS hợp lệ' })
      return false
    }
    return true
  }

  const testConnection = async () => {
    if (!validateConfig() || !validateTestUrl()) return

    // Prevent concurrent connection tests
    if (saving) {
      console.log('WooCommerce connection test already in progress, skipping...')
      return
    }

    setSaving(true)
    setStatus({ type: 'info', message: '🔄 Đang test kết nối WooCommerce...' })
    setTestResults(null)

    try {
      const results = await WooCommerceConfigService.testGlobalWooCommerceConnection(testBaseUrl)
      setTestResults(results)

      if (results.success) {
        setStatus({
          type: 'success',
          message: `✅ Kết nối thành công! Store: ${results.data?.store_name || 'Unknown'}, Version: ${results.data?.version || 'Unknown'}`
        })
      } else {
        setStatus({
          type: 'error',
          message: `❌ Kết nối thất bại: ${results.message}`
        })
      }
    } catch (error: any) {
      console.error('WooCommerce connection test failed:', error)
      const errorMessage = error?.message || 'Unknown connection error'
      setStatus({ type: 'error', message: `❌ Lỗi test kết nối: ${errorMessage}` })
      setTestResults({ success: false, error: errorMessage })
    } finally {
      setSaving(false)
    }
  }

  const saveConfig = async () => {
    if (!validateConfig()) return

    // Prevent multiple saves
    if (saving) {
      console.log('⚠️ Save already in progress, skipping...')
      return
    }

    setSaving(true)
    setStatus({ type: 'info', message: '💾 Đang lưu cấu hình WooCommerce...' })

    try {
      console.log('🔄 Starting WooCommerce config save...')
      await WooCommerceConfigService.saveWooCommerceConfig(config)

      console.log('✅ WooCommerce config save completed')
      setStatus({ type: 'success', message: '✅ Cấu hình WooCommerce đã được lưu thành công!' })

      // Reload configuration to verify it was saved (with timeout protection)
      setTimeout(() => {
        if (!saving) { // Only reload if not still saving
          loadCurrentConfig()
        }
      }, 1000)

    } catch (error: any) {
      console.error('❌ Failed to save WooCommerce config:', error)
      setStatus({ type: 'error', message: `❌ Lỗi lưu cấu hình: ${error?.message || 'Unknown error'}` })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    setConfig({
      consumer_key: '',
      consumer_secret: '',
      version: 'wc/v3',
      timeout: 10000
    })
    setTestBaseUrl('')
    setStatus(null)
    setTestResults(null)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center">
          <div className="text-blue-600 text-lg">⏳ Đang tải cấu hình WooCommerce...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              🛒 Cấu hình WooCommerce (Tập trung)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Consumer Key và Secret sẽ được sử dụng cho tất cả projects. Mỗi project chỉ cần cấu hình Base URL riêng.
            </p>
          </div>
          <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
            🔒 Admin Only
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Message */}
        {status && (
          <div className={`p-4 rounded-md ${
            status.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {status.message}
          </div>
        )}

        {/* WooCommerce Credentials */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">🔑 WooCommerce Credentials (Chung cho tất cả projects)</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consumer Key
              </label>
              <input
                type={showSensitiveData ? 'text' : 'password'}
                value={config.consumer_key}
                onChange={(e) => handleInputChange('consumer_key', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxx"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Consumer Secret
              </label>
              <input
                type={showSensitiveData ? 'text' : 'password'}
                value={config.consumer_secret}
                onChange={(e) => handleInputChange('consumer_secret', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="cs_xxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
          </div>

          {/* Show/Hide sensitive data */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showSensitive"
              checked={showSensitiveData}
              onChange={(e) => setShowSensitiveData(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="showSensitive" className="text-sm text-gray-600">
              👁️ Hiển thị dữ liệu nhạy cảm
            </label>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900">⚙️ Cài đặt nâng cao</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Version
              </label>
              <select
                value={config.version}
                onChange={(e) => handleInputChange('version', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="wc/v3">WC API v3</option>
                <option value="wc/v2">WC API v2</option>
                <option value="wc/v1">WC API v1</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Timeout (ms)
              </label>
              <input
                type="number"
                value={config.timeout}
                onChange={(e) => handleInputChange('timeout', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="5000"
                max="120000"
                step="1000"
              />
            </div>
          </div>
        </div>

        {/* Test Connection */}
        <div className="space-y-4 border-t pt-6">
          <h4 className="font-medium text-gray-900">🧪 Test kết nối</h4>
          <p className="text-sm text-gray-600">
            Nhập URL của một website để test kết nối với credentials trên
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website URL để test
            </label>
            <input
              type="url"
              value={testBaseUrl}
              onChange={(e) => setTestBaseUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com"
            />
          </div>

          <button
            onClick={testConnection}
            disabled={saving || !config.consumer_key || !config.consumer_secret || !testBaseUrl}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? '🔄 Đang test...' : '🧪 Test Connection'}
          </button>

          {/* Test Results */}
          {testResults && (
            <div className={`p-4 rounded-md ${
              testResults.success
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              <div className="font-medium">
                {testResults.success ? '✅ Test thành công!' : '❌ Test thất bại'}
              </div>
              {testResults.data && (
                <div className="mt-2 text-sm">
                  <div>Store: {testResults.data.store_name}</div>
                  <div>Version: {testResults.data.version}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-6 border-t">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            🔄 Reset về mặc định
          </button>

          <div className="space-x-3">
            <button
              onClick={loadCurrentConfig}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
            >
              {loading ? '⏳' : '🔄'} Tải lại
            </button>

            <button
              onClick={saveConfig}
              disabled={saving || !config.consumer_key || !config.consumer_secret}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '💾 Đang lưu...' : '💾 Lưu cấu hình'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}