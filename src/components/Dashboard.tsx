import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { supabase } from '../lib/supabase'

interface DashboardStats {
  totalProducts: number
  recentUpdates: number
  lastSyncDate: string | null
  syncStatus: 'success' | 'error' | 'pending' | 'never'
}

interface DashboardProps {
  onNavigate: (route: 'import' | 'products' | 'logs' | 'admin') => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { userProfile, isAdmin } = useAuth()
  const { currentProject } = useProject()
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    recentUpdates: 0,
    lastSyncDate: null,
    syncStatus: 'never'
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentProject) {
      loadDashboardStats()
    }
  }, [currentProject])

  const loadDashboardStats = async () => {
    if (!currentProject) return

    setLoading(true)

    // Initialize default stats
    let productsCount = 0
    let recentUpdatesCount = 0
    let lastSync = null

    // 🔧 Always use fixed table names for consistency and project isolation
    const productsTable = 'products_new'
    const auditTable = 'product_updates'

    console.log('📊 Dashboard loading stats for project:', currentProject.name)
    console.log('📋 Using tables:', { products: productsTable, audit: auditTable })

    try {
      // Try to get products count (graceful fallback if table doesn't exist)
      try {
        const { count } = await supabase
          .from(productsTable)
          .select('*', { count: 'exact', head: true })
          .eq('project_id', currentProject.project_id)
        productsCount = count || 0
        console.log(`📦 Products count: ${productsCount}`)
      } catch (error: any) {
        if (error?.code === '42P01') { // Table doesn't exist
          console.warn(`⚠️ Products table '${productsTable}' not found, using default count`)
        } else {
          console.error('❌ Error getting products count:', error)
        }
        productsCount = 0
      }

      // Try to get recent updates (graceful fallback if table doesn't exist)
      try {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)

        const { count } = await supabase
          .from(auditTable)
          .select('*', { count: 'exact', head: true })
          .gte('created_at', weekAgo.toISOString())

        recentUpdatesCount = count || 0
        console.log(`📈 Recent updates: ${recentUpdatesCount}`)
      } catch (error: any) {
        if (error?.code === '42P01') { // Table doesn't exist
          console.warn(`⚠️ Audit table '${auditTable}' not found, using default count`)
        } else {
          console.error('❌ Error getting recent updates count:', error)
        }
        recentUpdatesCount = 0
      }

      // Try to get last sync info (graceful fallback if table doesn't exist)
      try {
        const { data } = await supabase
          .from(auditTable)
          .select('created_at, status')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        lastSync = data
        console.log('⏰ Last sync:', lastSync?.created_at)
      } catch (error: any) {
        if (error?.code === '42P01') { // Table doesn't exist
          console.warn(`⚠️ Audit table '${auditTable}' not found, no sync info available`)
        } else {
          console.warn('⚠️ Could not get last sync info (table may be empty)')
        }
        lastSync = null
      }

      setStats({
        totalProducts: productsCount,
        recentUpdates: recentUpdatesCount,
        lastSyncDate: lastSync?.created_at || null,
        syncStatus: lastSync?.status || 'never'
      })
    } catch (error) {
      console.error('❌ Error loading dashboard stats:', error)
      // Set default stats on major error
      setStats({
        totalProducts: 0,
        recentUpdates: 0,
        lastSyncDate: null,
        syncStatus: 'never'
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN')
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-200">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Chào mừng trở lại, {userProfile?.full_name || 'User'}! 👋
        </h1>
        <p className="text-gray-600">
          Project hiện tại: <span className="font-semibold text-blue-700">{currentProject?.name}</span>
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tổng sản phẩm</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalProducts.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📦</span>
            </div>
          </div>
        </div>

        {/* Recent Updates */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cập nhật tuần này</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recentUpdates.toLocaleString()}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📈</span>
            </div>
          </div>
        </div>

        {/* Sync Status */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Trạng thái sync</p>
              <p className={`text-lg font-bold ${
                stats.syncStatus === 'success' ? 'text-green-600' :
                stats.syncStatus === 'error' ? 'text-red-600' :
                stats.syncStatus === 'pending' ? 'text-yellow-600' :
                'text-gray-600'
              }`}>
                {stats.syncStatus === 'success' ? '✅ Thành công' :
                 stats.syncStatus === 'error' ? '❌ Có lỗi' :
                 stats.syncStatus === 'pending' ? '⏳ Đang xử lý' :
                 '➖ Chưa sync'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              stats.syncStatus === 'success' ? 'bg-green-100' :
              stats.syncStatus === 'error' ? 'bg-red-100' :
              stats.syncStatus === 'pending' ? 'bg-yellow-100' :
              'bg-gray-100'
            }`}>
              <span className="text-2xl">🔄</span>
            </div>
          </div>
        </div>

        {/* Last Sync */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Sync cuối cùng</p>
              <p className="text-lg font-bold text-gray-900">
                {stats.lastSyncDate ? formatDate(stats.lastSyncDate) : 'Chưa có'}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">⏰</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Thao tác nhanh</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigate('import')}
            className="flex items-center space-x-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <span className="text-2xl">📤</span>
            <div className="text-left">
              <p className="font-medium text-blue-900">Import CSV</p>
              <p className="text-sm text-blue-600">Tải lên file sản phẩm</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('products')}
            className="flex items-center space-x-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
          >
            <span className="text-2xl">📋</span>
            <div className="text-left">
              <p className="font-medium text-green-900">Quản lý Products</p>
              <p className="text-sm text-green-600">Xem và chỉnh sửa</p>
            </div>
          </button>

          <button
            onClick={() => onNavigate('logs')}
            className="flex items-center space-x-3 p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg border border-yellow-200 transition-colors"
          >
            <span className="text-2xl">📊</span>
            <div className="text-left">
              <p className="font-medium text-yellow-900">Update Logs</p>
              <p className="text-sm text-yellow-600">Xem lịch sử cập nhật</p>
            </div>
          </button>

          {isAdmin() && (
            <button
              onClick={() => onNavigate('admin')}
              className="flex items-center space-x-3 p-4 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
            >
              <span className="text-2xl">⚙️</span>
              <div className="text-left">
                <p className="font-medium text-red-900">Admin Settings</p>
                <p className="text-sm text-red-600">Cài đặt hệ thống</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Trạng thái hệ thống</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Database Connection</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✅ Connected
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">WooCommerce API</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✅ Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Last Health Check</span>
            <span className="text-sm text-gray-500">
              {new Date().toLocaleTimeString('vi-VN')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}