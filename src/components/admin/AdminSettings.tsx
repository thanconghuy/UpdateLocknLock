import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { UserRole } from '../../types/auth'
import DatabaseConfigModule from './DatabaseConfigModule'
import SystemSetupChecker from './SystemSetupChecker'
import UserManagement from './UserManagement'

export default function AdminSettings() {
  const { userProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<'database' | 'users'>('database')
  const [systemReady, setSystemReady] = useState(false)

  // Check if user is admin
  if (!userProfile || userProfile.role !== UserRole.ADMIN) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            You need administrator privileges to access system settings.
          </p>
          <p className="text-sm text-gray-500">
            Current role: <span className="font-medium">{userProfile?.role || 'Unknown'}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">System Settings</h1>
              <p className="text-gray-600 mt-1">Configure database, WooCommerce connections and manage users</p>
            </div>
            <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
              🔒 Admin Only
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="flex">
            <button
              onClick={() => setActiveTab('database')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'database'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>🗄️</span>
                Database
              </div>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                activeTab === 'users'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span>👥</span>
                Users
              </div>
            </button>
          </div>
        </div>

        {/* System Setup Check */}
        {!systemReady && (
          <SystemSetupChecker onSetupComplete={() => setSystemReady(true)} />
        )}

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'database' && (
            systemReady ? <DatabaseConfigModule /> : <SystemSetupChecker onSetupComplete={() => setSystemReady(true)} />
          )}
          {activeTab === 'users' && <UserManagement />}
        </div>
      </div>
    </div>
  )
}