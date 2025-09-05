import React, { useState } from 'react'
import ImportPage from './components/ImportPage'
import ProductsPage from './components/ProductsPage'
import UpdateLogsPage from './components/UpdateLogsPage'
import SupabaseConnector from './components/SupabaseConnector'
import { CSVRow, ProductData } from './types'
import { smartMapCSVData } from './utils/smartCSVMapper'

export default function App() {
  const [rows, setRows] = useState<ProductData[]>([])
  const [errors, setErrors] = useState<any[]>([])
  const [route, setRoute] = useState<'import'|'products'|'logs'>('products')

  function handleFileLoad(data: CSVRow[]) {
    const mapped = smartMapCSVData(data)
    setRows(mapped)
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
          <ProductsPage data={rows} />
        ) : (
          <UpdateLogsPage />
        )}

        <div className="mt-6">
          <SupabaseConnector onConnect={() => {}} data={rows} />
        </div>
      </main>
    </div>
  )
}
