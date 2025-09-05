import React, { useMemo, useState, useEffect } from 'react'
import type { ProductData } from '../types'

interface DataTableProps {
  data: ProductData[]
  onEdit?: (id: string, field: string, value: string) => void
  onBulkAction?: (action: string, ids: string[]) => void
}

export default function DataTable({ data, onEdit, onBulkAction }: DataTableProps) {
  // define columns for normalized product data
  const columns = useMemo(() => [
    { key: 'id', label: 'ID', width: 'w-20' },
    { key: 'websiteId', label: 'Website ID', width: 'w-24' },
    { key: 'title', label: 'Tên sản phẩm', width: 'w-48' },
    { key: 'price', label: 'Giá thường', width: 'w-24' },
    { key: 'promotionalPrice', label: 'Giá KM', width: 'w-24' },
    { key: 'category', label: 'Danh mục', width: 'w-32' },
    { key: 'sku', label: 'SKU', width: 'w-24' },
    { key: 'linkShopee', label: 'Shopee', width: 'w-32' },
    { key: 'linkTiktok', label: 'TikTok', width: 'w-32' },
    { key: 'linkLazada', label: 'Lazada', width: 'w-32' },
    { key: 'linkDmx', label: 'DMX', width: 'w-32' },
    { key: 'externalUrl', label: 'URL khác', width: 'w-32' },
    { key: 'imageUrl', label: 'Hình ảnh', width: 'w-32' }
  ], [])

  // pagination state
  const [pageSize, setPageSize] = useState<number>(10)
  const [page, setPage] = useState<number>(1)

  const totalRows = data.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  // keep page in-bounds when data or pageSize changes
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
    if (page < 1) setPage(1)
  }, [page, totalPages])

  const start = (page - 1) * pageSize
  const end = start + pageSize
  const pageData = data.slice(start, end)

  return (
    <div className="bg-white rounded shadow p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-700">Rows: {totalRows}</div>
        <div className="flex items-center gap-2">
          <label className="text-sm">Rows per page</label>
          <select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="border p-1 rounded"
          >
            <option value="10">10</option>
            <option value="50">50</option>
            <option value="200">200</option>
          </select>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full table-fixed text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 w-12">#</th>
              {columns.map((col) => (
                <th key={col.key} className={`p-2 text-left align-top truncate ${col.width}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pageData.map((row, idx) => (
              <tr key={row.id} className="border-t">
                <td className="p-2 align-top">{start + idx + 1}</td>
                {columns.map((col) => (
                  <td key={col.key} className={`p-2 align-top ${col.width}`}>
                    <div className="text-xs break-words vietnamese-text">
                      {col.key === 'price' || col.key === 'promotionalPrice' 
                        ? (row[col.key as keyof ProductData] ? `${row[col.key as keyof ProductData]?.toLocaleString('vi-VN')}₫` : '') 
                        : col.key === 'imageUrl' && row.imageUrl
                          ? <img src={row.imageUrl} alt="" className="w-8 h-8 object-cover rounded" />
                          : col.key === 'externalUrl' && row.externalUrl
                            ? <a href={row.externalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate block">Link</a>
                            : ['linkShopee', 'linkTiktok', 'linkLazada', 'linkDmx'].includes(col.key)
                              ? (() => {
                                  const linkKey = col.key as keyof ProductData
                                  const priceKey = col.key.replace('link', 'gia') as keyof ProductData
                                  const link = row[linkKey] as string
                                  const price = row[priceKey] as number
                                  
                                  if (!link && !price) return <span className="text-gray-400">-</span>
                                  
                                  return (
                                    <div className="space-y-1">
                                      {link && (
                                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline block truncate">
                                          🔗
                                        </a>
                                      )}
                                      {price && price > 0 && (
                                        <div className="text-green-700 font-semibold">
                                          {price.toLocaleString('vi-VN')}₫
                                        </div>
                                      )}
                                    </div>
                                  )
                                })()
                            : String(row[col.key as keyof ProductData] ?? '')
                      }
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="p-4 text-center text-gray-500">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="text-sm text-gray-600">Page {page} / {totalPages}</div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
