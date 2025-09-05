import React from 'react'
import { useStore } from '../store/useStore'

export default function UpdateLogsComponent() {
  const { updateLogs } = useStore()

  if (updateLogs.length === 0) {
    return (
      <div className="neo-card p-4">
        <h3 className="text-lg font-semibold mb-4">WooCommerce Update Logs</h3>
        <div className="text-center text-gray-500">
          No update logs yet. Updates will appear here.
        </div>
      </div>
    )
  }

  const syncCount = updateLogs.filter(log => log.operation === 'sync').length
  const updateCount = updateLogs.filter(log => log.operation === 'update').length

  return (
    <div className="neo-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          WooCommerce Activity Logs ({updateLogs.length})
        </h3>
        <div className="flex gap-2 text-xs">
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
            🔄 Sync: {syncCount}
          </span>
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
            💾 Update: {updateCount}
          </span>
        </div>
      </div>
      
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {updateLogs.map((log) => (
          <div
            key={log.id}
            className={`p-3 border rounded-lg ${
              log.status === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  log.status === 'success' ? 'text-green-700' : 'text-red-700'
                }`}>
                  {log.operation === 'sync' ? '🔄' : '💾'} 
                  {log.status === 'success' ? 'Success' : 'Failed'} 
                  ({log.operation === 'sync' ? 'Sync from Website' : 'Update to Website'})
                </span>
                <span className="text-xs text-gray-500">
                  {log.timestamp.toLocaleString('vi-VN')}
                </span>
              </div>
              <div className="text-xs text-gray-600">
                ID: {log.websiteId || 'N/A'}
              </div>
            </div>
            
            <div className="text-sm text-gray-800 mb-1">
              <strong>Product:</strong> {log.title || 'Untitled'}
            </div>
            
            <div className="text-xs text-gray-600">
              <strong>Internal ID:</strong> {log.productId}
            </div>
            
            {log.error && (
              <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded">
                <strong>Error:</strong> {log.error}
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t">
        <div className="text-xs text-gray-500 text-center">
          Latest updates appear at the top
        </div>
      </div>
    </div>
  )
}