import React, { useState, useEffect } from 'react'
import { UserRole, UserProfile, ProjectMember, UserActivityLog } from '../../types/auth'
import { createPermissionChecker } from '../../utils/permissions'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

interface UserManagementProps {
  onClose?: () => void
}

export default function UserManagement({ onClose }: UserManagementProps) {
  const { userProfile } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [userProjects, setUserProjects] = useState<ProjectMember[]>([])
  const [userActivity, setUserActivity] = useState<UserActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')

  const permissionChecker = userProfile ? createPermissionChecker(userProfile) : null

  // Check if current user can manage users
  useEffect(() => {
    if (!permissionChecker?.canManageUsers()) {
      setError('Bạn không có quyền quản lý người dùng')
      return
    }
    fetchUsers()
  }, [permissionChecker])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsers(data || [])
    } catch (err: any) {
      setError('Lỗi tải danh sách người dùng: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserDetails = async (user: UserProfile) => {
    try {
      // Fetch user's projects
      const { data: projects } = await supabase
        .from('project_members')
        .select(`
          *,
          project:projects(name, slug),
          user:user_profiles(email, full_name)
        `)
        .eq('user_id', user.id)

      setUserProjects(projects || [])

      // Fetch recent activity
      const { data: activity } = await supabase
        .from('user_activity_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setUserActivity(activity || [])
      setSelectedUser(user)
    } catch (err: any) {
      console.error('Error fetching user details:', err)
    }
  }

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      // Update local state
      setUsers(prev =>
        prev.map(user =>
          user.id === userId
            ? { ...user, role: newRole }
            : user
        )
      )

      // Update selected user if it's the one being edited
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, role: newRole } : null)
      }

      setIsEditing(false)
    } catch (err: any) {
      setError('Lỗi cập nhật role: ' + err.message)
    }
  }

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          is_active: !isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) throw error

      // Update local state
      setUsers(prev =>
        prev.map(user =>
          user.id === userId
            ? { ...user, is_active: !isActive }
            : user
        )
      )

      if (selectedUser?.id === userId) {
        setSelectedUser(prev => prev ? { ...prev, is_active: !isActive } : null)
      }
    } catch (err: any) {
      setError('Lỗi thay đổi trạng thái: ' + err.message)
    }
  }

  const getRoleIcon = (role?: string): string => {
    if (!role) return '❓'
    switch (role as UserRole) {
      case UserRole.ADMIN: return '👑'
      case UserRole.MANAGER: return '🏢'
      case UserRole.PRODUCT_EDITOR: return '✏️'
      case UserRole.PROJECT_VIEWER: return '👁️'
      case UserRole.VIEWER: return '👤'
      default: return '❓'
    }
  }

  const getRoleColor = (role?: string): string => {
    if (!role) return 'text-gray-600 bg-gray-100'
    switch (role as UserRole) {
      case UserRole.ADMIN: return 'text-red-600 bg-red-100'
      case UserRole.MANAGER: return 'text-blue-600 bg-blue-100'
      case UserRole.PRODUCT_EDITOR: return 'text-green-600 bg-green-100'
      case UserRole.PROJECT_VIEWER: return 'text-purple-600 bg-purple-100'
      case UserRole.VIEWER: return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  if (!permissionChecker?.canManageUsers()) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-600 text-lg mb-2">❌ Không có quyền truy cập</div>
        <p className="text-gray-600">Bạn không có quyền quản lý người dùng</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="text-blue-600 text-lg">⏳ Đang tải danh sách người dùng...</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">
            👥 Quản lý người dùng
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search and Filter */}
        <div className="mt-4 flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Tìm kiếm theo email hoặc tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Tất cả vai trò</option>
              <option value={UserRole.ADMIN}>👑 Admin</option>
              <option value={UserRole.MANAGER}>🏢 Manager</option>
              <option value={UserRole.PRODUCT_EDITOR}>✏️ Product Editor</option>
              <option value={UserRole.PROJECT_VIEWER}>👁️ Project Viewer</option>
              <option value={UserRole.VIEWER}>👤 Viewer</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="text-red-600">{error}</div>
        </div>
      )}

      <div className="flex">
        {/* User List */}
        <div className="w-1/2 border-r border-gray-200">
          <div className="p-4">
            <div className="text-sm text-gray-600 mb-3">
              Tổng số: {filteredUsers.length} người dùng
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredUsers.map(user => {
                const userPermChecker = createPermissionChecker(user)
                return (
                  <div
                    key={user.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedUser?.id === user.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => fetchUserDetails(user)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{user.email}</div>
                        {user.full_name && (
                          <div className="text-sm text-gray-600">{user.full_name}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            getRoleColor(user.role)
                          }`}>
                            {getRoleIcon(user.role)} {user.role}
                          </span>
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                            user.is_active
                              ? 'text-green-800 bg-green-100'
                              : 'text-red-800 bg-red-100'
                          }`}>
                            {user.is_active ? '✅ Hoạt động' : '❌ Tạm ngưng'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* User Details */}
        <div className="w-1/2">
          {selectedUser ? (
            <div className="p-4">
              <div className="border-b border-gray-200 pb-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{selectedUser.email}</h3>
                    {selectedUser.full_name && (
                      <p className="text-gray-600">{selectedUser.full_name}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsEditing(!isEditing)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                    >
                      {isEditing ? 'Hủy' : 'Chỉnh sửa'}
                    </button>
                    <button
                      onClick={() => toggleUserStatus(selectedUser.id, selectedUser.is_active)}
                      className={`px-3 py-1 text-sm rounded-md ${
                        selectedUser.is_active
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {selectedUser.is_active ? 'Tạm ngưng' : 'Kích hoạt'}
                    </button>
                  </div>
                </div>

                {/* Role Editor */}
                {isEditing && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-md">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vai trò:
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.values(UserRole).map(role => (
                        <button
                          key={role}
                          onClick={() => updateUserRole(selectedUser.id, role)}
                          className={`p-2 text-left rounded-md transition-colors ${
                            selectedUser.role === role
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span className="font-medium">{getRoleIcon(role)} {role}</span>
                          <div className="text-sm text-gray-600 mt-1">
                            {createPermissionChecker({ ...selectedUser, role }).getRoleDescription()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">📊 Thông tin</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Tạo: {new Date(selectedUser.created_at).toLocaleDateString('vi-VN')}</div>
                    <div>Cập nhật: {new Date(selectedUser.updated_at).toLocaleDateString('vi-VN')}</div>
                    {selectedUser.last_active_at && (
                      <div>Hoạt động cuối: {new Date(selectedUser.last_active_at).toLocaleDateString('vi-VN')}</div>
                    )}
                  </div>
                </div>

                {/* Projects */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">📁 Projects ({userProjects.length})</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {userProjects.map(member => (
                      <div key={member.id} className="text-sm p-2 bg-gray-50 rounded">
                        <div className="font-medium">{(member as any).project?.name || 'Unknown Project'}</div>
                        <div className="text-gray-600">Role: {member.role}</div>
                      </div>
                    ))}
                    {userProjects.length === 0 && (
                      <div className="text-sm text-gray-500">Chưa tham gia project nào</div>
                    )}
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">📝 Hoạt động gần đây</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {userActivity.map(activity => (
                      <div key={activity.id} className="text-sm p-2 bg-gray-50 rounded">
                        <div className="font-medium">{activity.action}</div>
                        <div className="text-gray-600">
                          {new Date(activity.created_at).toLocaleString('vi-VN')}
                        </div>
                      </div>
                    ))}
                    {userActivity.length === 0 && (
                      <div className="text-sm text-gray-500">Chưa có hoạt động</div>
                    )}
                  </div>
                </div>

                {/* Permissions Summary */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">🔐 Quyền hạn</h4>
                  <div className="text-sm text-gray-600">
                    {createPermissionChecker(selectedUser).getAvailableActions().map((action, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        <span>{action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">👤</div>
              <p>Chọn một người dùng để xem chi tiết</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}