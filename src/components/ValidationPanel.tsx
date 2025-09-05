import React from 'react'
import type { ValidationError, ValidationWarning } from '../types'

interface ValidationPanelProps {
  errors: ValidationError[]
  warnings: ValidationWarning[]
  onFix: (errorId: string) => void
}

export default function ValidationPanel({ errors, warnings, onFix }: ValidationPanelProps) {
  return (
    <div className="bg-white rounded shadow p-4">
      <h3 className="font-semibold">Validation</h3>
      <div className="mt-2">
        <h4 className="font-medium">Errors ({errors.length})</h4>
        <ul className="list-disc ml-6 text-sm">
          {errors.map((e) => (
            <li key={e.id}>
              {e.rowId} - {e.field}: {e.message}{' '}
              <button className="text-blue-600" onClick={() => onFix(e.id)}>
                Fix
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <h4 className="font-medium">Warnings ({warnings.length})</h4>
        <ul className="list-disc ml-6 text-sm">
          {warnings.map((w) => (
            <li key={w.id}>{w.rowId} - {w.field}: {w.message}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
