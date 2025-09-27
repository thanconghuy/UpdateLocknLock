import React from 'react'

export default function TestApp() {
  console.log('🧪 TestApp is rendering...')

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#059669', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          ✅ React App is Working!
        </h1>
        <p style={{ color: '#374151', marginBottom: '1rem' }}>
          The localhost server is running correctly
        </p>
        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
          <p>Port: 5174</p>
          <p>Status: Active</p>
          <p>Environment: {import.meta.env.DEV ? 'Development' : 'Production'}</p>
        </div>
      </div>
    </div>
  )
}