import React, { useState, useEffect } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { ProjectProvider, useProject } from './contexts/ProjectContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Header from './components/layout/Header'
import ProjectSelector from './components/project/ProjectSelector'
import ImportPage from './components/ImportPage'
import ProductsPage from './components/ProductsPage'
import UpdateLogsPage from './components/UpdateLogsPage'
import AdminSettings from './components/admin/AdminSettings'
import UserManagement from './components/admin/UserManagement'
import Dashboard from './components/Dashboard'
import ProjectManagement from './components/project/ProjectManagement'
import UserRoleDebug from './components/debug/UserRoleDebug'
import { CSVRow, ProductData } from './types'
import { smartMapCSVData } from './utils/smartCSVMapper'
import './scripts/debugLoading' // Auto-run debug on app load
import './scripts/testConnection' // Test Supabase connection

function ProjectApp() {
  const [rows, setRows] = useState<ProductData[]>([])
  const [errors, setErrors] = useState<any[]>([])
  const [route, setRoute] = useState<'dashboard'|'import'|'products'|'logs'|'admin'|'projects'|'users'>('dashboard')
  const [refreshKey, setRefreshKey] = useState(0)

  const { currentProject, showProjectSelector } = useProject()

  // 🔄 Clear imported data when switching projects to prevent contamination
  useEffect(() => {
    if (currentProject) {
      console.log('🧹 App: Clearing imported rows for project switch:', currentProject.name)
      setRows([]) // Clear imported CSV data when project changes
      setErrors([]) // Also clear any import errors
    }
  }, [currentProject?.id])

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

  // Show project selector if no project selected or explicitly requested
  if (!currentProject || showProjectSelector) {
    return <ProjectSelector />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Debug component - remove in production */}
      <UserRoleDebug />
      <Header route={route} setRoute={setRoute} />

      <main className="container mx-auto p-4">
        {/* Project Info */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-blue-700 font-medium">Active Project:</span>
              <span className="ml-2 text-blue-900 font-semibold">{currentProject.name}</span>
            </div>
            <div className="text-sm text-blue-600">
              {currentProject.woocommerce_base_url.replace(/https?:\/\//, '')}
            </div>
          </div>
        </div>

        {route === 'dashboard' ? (
          <Dashboard onNavigate={setRoute} />
        ) : route === 'import' ? (
          <ImportPage rows={rows} setRows={setRows} errors={errors} setErrors={setErrors} />
        ) : route === 'products' ? (
          <ProductsPage
            key={`${refreshKey}-${currentProject.project_id}`}
            refreshKey={refreshKey}
            onSyncComplete={handleSyncComplete}
            onReloadProducts={handleReloadProducts}
          />
        ) : route === 'admin' ? (
          <AdminSettings />
        ) : route === 'projects' ? (
          <ProjectManagement />
        ) : route === 'users' ? (
          <UserManagement />
        ) : (
          <UpdateLogsPage />
        )}
      </main>

      {/* Debug component - show user role info */}
      <UserRoleDebug />
    </div>
  )
}

function AuthenticatedApp() {
  return (
    <ProjectProvider>
      <ProjectApp />
    </ProjectProvider>
  )
}

export default function App() {
  console.log('🚀 Loading full app with authentication and projects...')

  try {
    return (
      <AuthProvider>
        <ProtectedRoute>
          <AuthenticatedApp />
        </ProtectedRoute>
      </AuthProvider>
    )
  } catch (error) {
    console.error('❌ App error:', error)
    return (
      <div className="min-h-screen bg-red-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            ❌ App Error
          </h1>
          <p className="text-gray-700 mb-2">
            {error instanceof Error ? error.message : 'Unknown error'}
          </p>
          <div className="mt-4 p-4 bg-gray-50 rounded text-left text-sm">
            <p><strong>If you see this:</strong></p>
            <p>1. Check browser console for details</p>
            <p>2. Try refreshing the page</p>
            <p>3. Check if database is accessible</p>
          </div>
        </div>
      </div>
    )
  }
}
