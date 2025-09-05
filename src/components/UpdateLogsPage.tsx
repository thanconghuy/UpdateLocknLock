import React, { useState, useEffect, useMemo } from 'react'
import { createClient } from '@supabase/supabase-js'

interface UpdateLog {
  id: number
  product_id?: number
  product_sku: string
  changes: string
  updated_at: string
  updated_by: string
  source: string
}

export default function UpdateLogsPage() {
  const [logs, setLogs] = useState<UpdateLog[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [filter, setFilter] = useState<{ sku?: string, source?: string, dateRange?: string }>({})
  const [selectedLog, setSelectedLog] = useState<UpdateLog | null>(null)

  const filteredLogs = useMemo(() => {
    let filtered = logs

    // Filter by SKU
    if (filter.sku) {
      filtered = filtered.filter(log => 
        log.product_sku.toLowerCase().includes(filter.sku!.toLowerCase())
      )
    }

    // Filter by source
    if (filter.source) {
      filtered = filtered.filter(log => log.source === filter.source)
    }

    // Filter by date range
    if (filter.dateRange) {
      const now = new Date()
      let cutoffDate = new Date()
      
      switch (filter.dateRange) {
        case '1h':
          cutoffDate = new Date(now.getTime() - 60 * 60 * 1000)
          break
        case '24h':
          cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case '7d':
          cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case '30d':
          cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          break
      }
      
      if (filter.dateRange !== 'all') {
        filtered = filtered.filter(log => new Date(log.updated_at) > cutoffDate)
      }
    }

    return filtered.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }, [logs, filter])

  const totalPages = Math.ceil(filteredLogs.length / pageSize)
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return filteredLogs.slice(start, end)
  }, [filteredLogs, currentPage, pageSize])

  async function fetchLogs() {
    setLoading(true)
    setStatus(null)
    try {
      const url = localStorage.getItem('supabase:url')
      const key = localStorage.getItem('supabase:key')
      const auditTable = localStorage.getItem('supabase:audit_table') || 'product_updates'
      
      if (!url || !key) {
        setStatus('No Supabase credentials found')
        setLoading(false)
        return
      }

      const supa = createClient(url, key)
      const { data, error } = await supa
        .from(auditTable)
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1000)

      if (error) {
        setStatus(`Error loading logs: ${error.message}`)
        setLogs([])
      } else {
        setLogs(data || [])
        setStatus(`Loaded ${data?.length || 0} update logs`)
      }
    } catch (err: any) {
      setStatus(`Fetch error: ${err?.message || String(err)}`)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 60) {
      return `${diffMins} phút trước`
    } else if (diffHours < 24) {
      return `${diffHours} giờ trước`
    } else if (diffDays < 7) {
      return `${diffDays} ngày trước`
    } else {
      return date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + ' ' + 
             date.toLocaleTimeString('vi-VN', { 
               timeZone: 'Asia/Ho_Chi_Minh', 
               hour: '2-digit', 
               minute: '2-digit' 
             })
    }
  }

  function formatDateTime(dateStr: string) {
    const date = new Date(dateStr)
    return date.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  function parseChanges(changesStr: string) {
    try {
      const changes = JSON.parse(changesStr)
      return changes
    } catch {
      return { raw: changesStr }
    }
  }

  function viewDetails(log: UpdateLog) {
    setSelectedLog(log)
  }

  function closeDetails() {
    setSelectedLog(null)
  }

  return (
    <div className="neo-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Product Update Logs</h2>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-600">
            {filteredLogs.length} logs ({logs.length} total)
          </span>
          <button 
            className="neo-btn"
            onClick={fetchLogs}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {status && (
        <div className={`mb-4 px-3 py-2 rounded text-sm ${
          status.includes('Error') || status.includes('error')
            ? 'bg-red-100 text-red-800'
            : 'bg-green-100 text-green-800'
        }`}>
          {status}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Search SKU</label>
          <input
            type="text"
            className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
            placeholder="Enter product SKU..."
            value={filter.sku || ''}
            onChange={(e) => {
              setFilter({ ...filter, sku: e.target.value || undefined })
              setCurrentPage(1)
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
          <select
            className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
            value={filter.source || ''}
            onChange={(e) => {
              setFilter({ ...filter, source: e.target.value || undefined })
              setCurrentPage(1)
            }}
          >
            <option value="">All sources</option>
            <option value="ui">Manual Edit (UI)</option>
            <option value="api">API Update</option>
            <option value="bulk">Bulk Update</option>
            <option value="sync">Data Sync</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Time Range</label>
          <select
            className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
            value={filter.dateRange || 'all'}
            onChange={(e) => {
              setFilter({ ...filter, dateRange: e.target.value === 'all' ? undefined : e.target.value })
              setCurrentPage(1)
            }}
          >
            <option value="all">All time</option>
            <option value="1h">Last hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Per Page</label>
          <select
            className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setCurrentPage(1)
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Pagination */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {Math.min((currentPage - 1) * pageSize + 1, filteredLogs.length)} to {Math.min(currentPage * pageSize, filteredLogs.length)} of {filteredLogs.length} logs
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="neo-btn" 
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
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

      {/* Logs Table */}
      <div className="overflow-auto">
        <table className="table-neo w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 border text-left">Time</th>
              <th className="p-2 border text-left">Product SKU</th>
              <th className="p-2 border text-left">Source</th>
              <th className="p-2 border text-left">Updated By</th>
              <th className="p-2 border text-left">Changes</th>
              <th className="p-2 border text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  {loading ? 'Loading logs...' : 'No update logs found'}
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => {
                const changes = parseChanges(log.changes)
                const changedFields = changes.changed_fields || []
                
                return (
                  <tr key={log.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      <div className="text-xs">
                        <div className="font-medium">{formatDate(log.updated_at)}</div>
                        <div className="text-gray-500">
                          {formatDateTime(log.updated_at)}
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{log.product_sku}</div>
                      {log.product_id && (
                        <div className="text-xs text-gray-500">ID: {log.product_id}</div>
                      )}
                    </td>
                    <td className="p-2">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        log.source === 'ui' 
                          ? 'bg-blue-100 text-blue-800'
                          : log.source === 'api'
                          ? 'bg-green-100 text-green-800'
                          : log.source === 'bulk'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {log.source === 'ui' ? 'Manual Edit' : log.source.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2 text-xs">{log.updated_by}</td>
                    <td className="p-2">
                      {changedFields.length > 0 ? (
                        <div className="text-xs">
                          <span className="font-medium">{changedFields.length} field(s) changed:</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {changedFields.slice(0, 3).map((field: string) => (
                              <span key={field} className="inline-flex px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                                {field}
                              </span>
                            ))}
                            {changedFields.length > 3 && (
                              <span className="text-gray-500">+{changedFields.length - 3} more</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">No field details</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        className="neo-btn text-xs px-2 py-1"
                        onClick={() => viewDetails(log)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Update Log Details</h3>
                <button
                  className="neo-btn text-sm"
                  onClick={closeDetails}
                >
                  ✕
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-600">
                <span className="font-medium">SKU:</span> {selectedLog.product_sku} • 
                <span className="font-medium"> Thời gian:</span> {formatDateTime(selectedLog.updated_at)} • 
                <span className="font-medium"> Nguồn:</span> {selectedLog.source}
              </div>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              <pre className="text-xs bg-gray-50 p-4 rounded border overflow-auto">
                {JSON.stringify(parseChanges(selectedLog.changes), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}