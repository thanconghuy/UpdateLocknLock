import React from 'react'
import FileUploader from './FileUploader'
import DataTable from './DataTable'
import ValidationPanel from './ValidationPanel'
import SupabaseConnector from './SupabaseConnector'
import type { CSVRow, ProductData } from '../types'
import { smartMapCSVData } from '../utils/smartCSVMapper'

interface Props {
  rows: ProductData[]
  setRows: (r: ProductData[]) => void
  errors: any[]
  setErrors: (e: any[]) => void
}

export default function ImportPage({ rows, setRows, errors, setErrors }: Props) {
  function handleFileLoad(data: CSVRow[]) {
    const mapped = smartMapCSVData(data)
    setRows(mapped)
  }

  return (
    <div className="space-y-6">
      <div className="neo-card p-4">
        <h2 className="text-lg font-semibold">Import CSV</h2>
        <div className="mt-3">
          <FileUploader onFileLoad={handleFileLoad} acceptedFormats={["text/csv"]} maxFileSize={10 * 1024 * 1024} />
        </div>
      </div>

      <div className="neo-card p-4">
        <h2 className="text-lg font-semibold">Preview</h2>
        <div className="mt-3">
          <DataTable data={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="neo-card p-4">
          <ValidationPanel errors={[]} warnings={[]} onFix={() => {}} />
        </div>
        <div className="neo-card p-4">
          <SupabaseConnector onConnect={() => {}} data={rows} />
        </div>
      </div>
    </div>
  )
}
