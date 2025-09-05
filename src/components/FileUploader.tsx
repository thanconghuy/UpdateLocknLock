import React from 'react'
import Papa from 'papaparse'
import type { CSVRow } from '../types'
import { debugCSVMapping, suggestFieldMappings } from '../utils/csvDebugger'
import { debugFieldDetection } from '../utils/smartCSVMapper'

// Utility function to decode HTML entities
function decodeHTMLEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

// Process CSV data to decode HTML entities and handle Vietnamese text
function processCSVData(data: CSVRow[]): CSVRow[] {
  return data.map(row => {
    const processedRow: CSVRow = {}
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === 'string') {
        // Decode HTML entities and trim whitespace
        processedRow[key] = decodeHTMLEntities(value).trim()
      } else {
        processedRow[key] = value
      }
    }
    return processedRow
  })
}

interface FileUploaderProps {
  onFileLoad: (data: CSVRow[]) => void
  acceptedFormats: string[]
  maxFileSize: number
}

export default function FileUploader({ onFileLoad, acceptedFormats, maxFileSize }: FileUploaderProps) {
  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (f.size > maxFileSize) {
      alert('File quá lớn. Vui lòng chọn file nhỏ hơn.')
      return
    }

    Papa.parse<CSVRow>(f, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        // Process the data to decode HTML entities and handle Vietnamese text properly
        const processedData = processCSVData(results.data)
        
        // Debug CSV mapping in development
        if (process.env.NODE_ENV === 'development' || true) {
          console.log('🔍 Debugging CSV import...')
          debugCSVMapping(processedData)
          
          console.log('\n🧠 Smart Field Detection:')
          debugFieldDetection(processedData)
          
          console.log('\n💡 Suggested field mappings:')
          const suggestions = suggestFieldMappings(processedData)
          Object.entries(suggestions).forEach(([field, matches]) => {
            if (matches.length > 0) {
              console.log(`  ${field}: ${matches.join(', ')}`)
            }
          })
        }
        
        onFileLoad(processedData)
      },
      error: (err) => {
        console.error('CSV parse error', err)
        alert('Lỗi đọc file CSV. Vui lòng kiểm tra định dạng file.')
      },
    })
  }

  return (
    <div className="p-4 border-2 border-dashed rounded bg-white">
      <input
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={(e) => handleFiles(e.target.files)}
        data-testid="file-input"
      />
      <p className="text-sm text-gray-600 mt-2">Kéo thả file CSV vào đây, hoặc click để chọn file.</p>
    </div>
  )
}
