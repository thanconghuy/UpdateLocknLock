import React, { useState } from 'react'
import { testWooCommerceConnection, type ConnectionTestResult } from '../utils/woocommerceConnectionTest'
import { ENV, hasRequiredEnvVars } from '../config/env'

export default function WooCommerceConnectionTest() {
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)

  const handleTestConnection = async () => {
    if (isLoading) return

    setIsLoading(true)
    setTestResult(null)

    try {
      console.clear()
      console.log('🔍 WOOCOMMERCE CONNECTION TEST STARTED')
      console.log('='.repeat(80))

      const result = await testWooCommerceConnection()
      setTestResult(result)

      // Show user notification
      if (result.success) {
        alert(
          `✅ Kết nối WooCommerce thành công!\n\n` +
          `📊 Thông tin:\n` +
          `• Website: ${result.details.baseUrl}\n` +
          `• Tìm thấy: ${result.details.totalProducts} sản phẩm\n` +
          `• Thời gian phản hồi: ${result.details.responseTime}ms\n\n` +
          `🔍 Xem Console (F12) để biết chi tiết đầy đủ!`
        )
      } else {
        alert(
          `❌ Kết nối WooCommerce thất bại!\n\n` +
          `🚫 Lỗi: ${result.message}\n\n` +
          `💡 Kiểm tra:\n` +
          `• URL website đúng chưa\n` +
          `• Consumer Key và Secret đúng chưa\n` +
          `• Website có hoạt động không\n` +
          `• WooCommerce REST API đã bật chưa\n\n` +
          `📋 Xem Console (F12) để biết chi tiết lỗi!`
        )
      }

    } catch (error) {
      console.error('❌ Test connection failed:', error)
      alert(
        `❌ Test thất bại!\n\n` +
        `Lỗi: ${error instanceof Error ? error.message : 'Lỗi không xác định'}\n\n` +
        `📞 Liên hệ support nếu vấn đề vẫn tiếp tục!`
      )
    } finally {
      setIsLoading(false)
    }
  }

  const isConfigured = hasRequiredEnvVars()

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">WooCommerce Connection Test</h3>
        {isConfigured && (
          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
            ⚙️ Configured
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Configuration Info */}
        <div className="text-sm bg-gray-50 p-3 rounded">
          <div className="font-medium text-gray-700 mb-2">📋 Current Configuration:</div>
          <div className="space-y-1 text-gray-600">
            <div>
              <span className="font-medium">Website:</span>
              <span className="ml-1">{ENV.WOOCOMMERCE_BASE_URL || 'Not configured'}</span>
            </div>
            <div>
              <span className="font-medium">Consumer Key:</span>
              <span className="ml-1 font-mono">
                {ENV.WOOCOMMERCE_CONSUMER_KEY
                  ? `${ENV.WOOCOMMERCE_CONSUMER_KEY.substring(0, 8)}...`
                  : 'Not configured'
                }
              </span>
            </div>
            <div>
              <span className="font-medium">Consumer Secret:</span>
              <span className="ml-1 font-mono">
                {ENV.WOOCOMMERCE_CONSUMER_SECRET
                  ? `${ENV.WOOCOMMERCE_CONSUMER_SECRET.substring(0, 8)}...`
                  : 'Not configured'
                }
              </span>
            </div>
          </div>
        </div>

        {/* Test Button */}
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded font-medium ${
              isConfigured && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
            onClick={handleTestConnection}
            disabled={!isConfigured || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Testing Connection...
              </span>
            ) : (
              '🔍 Test WooCommerce Connection'
            )}
          </button>
        </div>

        {/* Test Results */}
        {testResult && (
          <div className={`p-3 rounded border-l-4 ${
            testResult.success
              ? 'bg-green-50 border-green-400'
              : 'bg-red-50 border-red-400'
          }`}>
            <h4 className={`font-medium mb-2 ${
              testResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {testResult.success ? '✅ Connection Successful' : '❌ Connection Failed'}
            </h4>

            <div className={`text-sm space-y-2 ${
              testResult.success ? 'text-green-700' : 'text-red-700'
            }`}>
              <div><strong>Message:</strong> {testResult.message}</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div><strong>Website:</strong> {testResult.details.baseUrl}</div>
                <div><strong>Credentials:</strong> {testResult.details.hasCredentials ? 'Valid' : 'Invalid'}</div>
                <div><strong>Response Time:</strong> {testResult.details.responseTime}ms</div>
                <div><strong>Products Found:</strong> {testResult.details.totalProducts ?? 'N/A'}</div>
              </div>

              {testResult.details.sampleProducts.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium mb-1">📦 Sample Products:</div>
                  <div className="space-y-1 text-xs">
                    {testResult.details.sampleProducts.slice(0, 3).map((product: any, index: number) => (
                      <div key={product.id} className="flex justify-between">
                        <span>[{product.id}] {product.name}</span>
                        <span>{product.regular_price || 'N/A'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testResult.details.errors.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium mb-1">❌ Errors:</div>
                  <div className="space-y-1 text-xs">
                    {testResult.details.errors.map((error, index) => (
                      <div key={index}>• {error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isConfigured && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            ⚠️ WooCommerce credentials not configured. Check environment variables:
            <div className="mt-1 font-mono text-xs">
              • VITE_WOOCOMMERCE_BASE_URL<br/>
              • VITE_WOOCOMMERCE_CONSUMER_KEY<br/>
              • VITE_WOOCOMMERCE_CONSUMER_SECRET
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <div className="font-medium mb-1">💡 How to use:</div>
          <div className="space-y-1">
            <div>• Click "Test Connection" to verify WooCommerce API access</div>
            <div>• Check Console (F12) for detailed connection logs</div>
            <div>• This test fetches sample products to verify API functionality</div>
            <div>• Make sure WooCommerce REST API is enabled on your website</div>
          </div>
        </div>
      </div>
    </div>
  )
}