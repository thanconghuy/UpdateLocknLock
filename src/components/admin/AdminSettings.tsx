import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { UserRole } from '../../types/auth'
import DatabaseConfigModule from './DatabaseConfigModule'
import SystemSetupChecker from './SystemSetupChecker'
import UserManagement from './UserManagement'
import EmailManagement from './email/EmailManagement'

export default function AdminSettings() {
  const { userProfile, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<'database' | 'users' | 'email'>('database')
  const [systemReady, setSystemReady] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefreshProfile = async () => {
    setRefreshing(true)
    try {
      await refreshProfile()
    } catch (error) {
      console.error('Error refreshing profile:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // Check if user is admin
  console.log('🔍 ADMIN SETTINGS: Checking admin access...')
  console.log('🔍 User profile:', userProfile)
  console.log('🔍 User role:', userProfile?.role)
  console.log('🔍 Role type:', typeof userProfile?.role)
  console.log('🔍 Is admin?:', userProfile?.role === 'admin')

  if (!userProfile || userProfile.role !== 'admin') {
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
          <p className="text-sm text-gray-500 mb-4">
            Current role: <span className="font-medium">{userProfile?.role || 'Unknown'}</span>
          </p>

          {(!userProfile || userProfile.role === 'Unknown' || !userProfile.role) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
              <h3 className="text-sm font-medium text-yellow-800 mb-2">🔧 Troubleshooting</h3>
              <ul className="text-xs text-yellow-700 space-y-1 mb-3">
                <li>• Role not loading? Try refreshing the page</li>
                <li>• Check if you have a user profile in the database</li>
                <li>• Contact administrator to assign admin role</li>
                <li>• Database connection might be failing</li>
              </ul>
              <button
                onClick={handleRefreshProfile}
                disabled={refreshing}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-400 text-white py-2 px-4 rounded text-sm font-medium transition-colors"
              >
                {refreshing ? '🔄 Refreshing...' : '🔄 Refresh Profile'}
              </button>
            </div>
          )}
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
            {/* Users tab - chỉ hiển thị cho Admin */}
            {userProfile?.role === 'admin' && (
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
            )}
            {/* Email tab - chỉ hiển thị cho Admin */}
            {userProfile?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('email')}
                className={`flex-1 px-6 py-4 text-center font-medium transition-colors ${
                  activeTab === 'email'
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span>📧</span>
                  Email
                </div>
              </button>
            )}
          </div>
        </div>

        {/* System Setup Check */}
        {!systemReady && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">System Setup Check</h3>
                <p className="text-gray-600">Checking database configuration...</p>
              </div>
              <button
                onClick={() => setSystemReady(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Skip Setup Check
              </button>
            </div>
            <div className="mt-4">
              <SystemSetupChecker onSetupComplete={() => setSystemReady(true)} />
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'database' && (
            systemReady ? <DatabaseConfigModule /> : <SystemSetupChecker onSetupComplete={() => setSystemReady(true)} />
          )}
          {activeTab === 'users' && (
            userProfile?.role === 'admin' ? (
              <UserManagement />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                <div className="text-red-500 text-6xl mb-4">🚫</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
                <p className="text-gray-600 mb-4">
                  User Management is only available to administrators.
                </p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    Current role: <span className="font-medium">{userProfile?.role || 'Unknown'}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Required role: <span className="font-medium text-red-600">admin</span>
                  </p>
                </div>
              </div>
            )
          )}
          {activeTab === 'email' && (
            userProfile?.role === 'admin' ? (
              <EmailManagement />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                <div className="text-red-500 text-6xl mb-4">🚫</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
                <p className="text-gray-600 mb-4">
                  Email Management is only available to administrators.
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}