import React, { useState } from 'react'
import ImportPage from './components/ImportPage'
import ProductsPage from './components/ProductsPage'
import UpdateLogsPage from './components/UpdateLogsPage'
import SupabaseConnector from './components/SupabaseConnector'
import ProductManagementCenter from './components/ProductManagementCenter'
import WooCommerceConnectionTest from './components/WooCommerceConnectionTest'
import { CSVRow, ProductData } from './types'
import { smartMapCSVData } from './utils/smartCSVMapper'

export default function App() {
  const [rows, setRows] = useState<ProductData[]>([])
  const [errors, setErrors] = useState<any[]>([])
  const [route, setRoute] = useState<'import'|'products'|'logs'>('products')
  const [refreshKey, setRefreshKey] = useState(0)

  function handleFileLoad(data: CSVRow[]) {
    const mapped = smartMapCSVData(data)
    setRows(mapped)
  }

  function handleSyncComplete() {
    console.log('🔄 handleSyncComplete() called - incrementing refreshKey from', refreshKey)
    setRefreshKey(prev => {
      console.log('🔄 refreshKey updated from', prev, 'to', prev + 1)
      return prev + 1
    })
  }

  function handleReloadProducts() {
    console.log('🔄 handleReloadProducts() called - incrementing refreshKey from', refreshKey)
    setRefreshKey(prev => {
      console.log('🔄 refreshKey updated from', prev, 'to', prev + 1)
      return prev + 1
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="p-4 border-b bg-white neo-panel">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold">WP Product CSV Reader</h1>
          <nav className="flex gap-3">
            <button className={`px-3 py-1 ${route === 'products' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => setRoute('products')}>Products</button>
            <button className={`px-3 py-1 ${route === 'logs' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => setRoute('logs')}>Update Logs</button>
            <button className={`px-3 py-1 ${route === 'import' ? 'neo-btn primary' : 'neo-btn'}`} onClick={() => setRoute('import')}>Import</button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto p-4">
        {route === 'import' ? (
          <ImportPage rows={rows} setRows={setRows} errors={errors} setErrors={setErrors} />
        ) : route === 'products' ? (
          <ProductsPage key={refreshKey} data={rows} refreshKey={refreshKey} />
        ) : (
          <UpdateLogsPage />
        )}

        <div className="mt-6 space-y-4">
          {/* <WooCommerceConnectionTest /> */}
          <ProductManagementCenter
            onSyncComplete={handleSyncComplete}
            onReloadProducts={handleReloadProducts}
          />
          <SupabaseConnector onConnect={() => {}} data={rows} />
        </div>
      </main>
    </div>
  )
}
