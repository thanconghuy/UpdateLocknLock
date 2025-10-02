import React, { useState, useEffect } from 'react'
import { ProjectMemberService, type ProjectRole, type UserPermissions } from '../../services/projectMemberService'
import type { ProjectMember } from '../../types/project'

interface ProjectMemberManagementProps {
  projectId: number
  projectName: string
  onClose: () => void
}

export default function ProjectMemberManagement({ projectId, projectName, onClose }: ProjectMemberManagementProps) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [roles, setRoles] = useState<ProjectRole[]>([])
  const [availableUsers, setAvailableUsers] = useState<Array<{
    id: string
    email: string
    full_name: string | null
    role: string
  }>>([])
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({
    can_manage_members: false,
    can_edit_project: false,
    can_delete_project: false,
    can_manage_woocommerce: false,
    can_edit_products: false,
    can_view_analytics: false
  })
  const [loading, setLoading] = useState(true)
  const [showAddMember, setShowAddMember] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [newMemberRole, setNewMemberRole] = useState('viewer')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    setLoading(true)
    try {
      const [membersData, rolesData, permissionsData, usersData] = await Promise.all([
        ProjectMemberService.getProjectMembers(projectId),
        ProjectMemberService.getAvailableRoles(),
        ProjectMemberService.getUserProjectPermissions(projectId),
        ProjectMemberService.getAvailableUsers(projectId)
      ])

      setMembers(membersData)
      setRoles(rolesData)
      setUserPermissions(permissionsData)
      setAvailableUsers(usersData)
    } catch (error) {
      console.error('❌ Error loading member data:', error)
      alert('❌ Có lỗi khi tải dữ liệu. Vui lòng kiểm tra console.')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserId) {
      alert('⚠️ Vui lòng chọn user')
      return
    }

    setAdding(true)
    try {
      // Thêm thành viên trực tiếp
      await ProjectMemberService.addProjectMember(projectId, selectedUserId, newMemberRole)

      const selectedUser = availableUsers.find(u => u.id === selectedUserId)
      alert(`✅ Đã thêm ${selectedUser?.full_name || selectedUser?.email} vào project`)

      setSelectedUserId('')
      setNewMemberRole('viewer')
      setShowAddMember(false)
      await loadData() // Reload để cập nhật danh sách
    } catch (error: any) {
      console.error('❌ Error adding member:', error)
      alert(`❌ ${error.message || 'Có lỗi khi thêm thành viên. Vui lòng thử lại.'}`)
    } finally {
      setAdding(false)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      await ProjectMemberService.updateMemberRole(memberId, newRole)
      alert('✅ Đã cập nhật vai trò thành công')
      await loadData()
    } catch (error) {
      console.error('❌ Error updating role:', error)
      alert('❌ Có lỗi khi cập nhật vai trò')
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa thành viên "${memberName}" khỏi project?`)) return

    try {
      await ProjectMemberService.removeMember(memberId)
      alert('✅ Đã xóa thành viên thành công')
      await loadData()
    } catch (error) {
      console.error('❌ Error removing member:', error)
      alert('❌ Có lỗi khi xóa thành viên')
    }
  }

  const getRoleDisplayName = (roleName: string) => {
    return roles.find(r => r.name === roleName)?.display_name || roleName
  }

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case 'admin': return 'bg-purple-100 text-purple-800'
      case 'manager': return 'bg-blue-100 text-blue-800'
      case 'product_editor': return 'bg-green-100 text-green-800'
      case 'project_viewer': return 'bg-yellow-100 text-yellow-800'
      case 'viewer': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Đang tải thông tin thành viên...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">👥 Quản lý thành viên</h2>
            <p className="text-sm text-gray-600">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Permission Check */}
          {!userPermissions.can_manage_members ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <span className="text-yellow-600 text-lg mr-2">⚠️</span>
                <div>
                  <p className="text-yellow-800 font-medium">Không có quyền quản lý thành viên</p>
                  <p className="text-yellow-700 text-sm">Bạn chỉ có thể xem danh sách thành viên trong project này.</p>
                </div>
              </div>
            </div>
          ) : (
            /* Add Member Button */
            <div className="mb-6">
              <button
                onClick={() => setShowAddMember(!showAddMember)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <span className="mr-2">➕</span>
                Mời thành viên mới
              </button>
            </div>
          )}

          {/* Add Member Form */}
          {showAddMember && userPermissions.can_manage_members && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-3">➕ Thêm thành viên mới</h3>

              {availableUsers.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ Không có user nào khả dụng để thêm. Tất cả users đã là thành viên của project này.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleAddMember} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">
                      Chọn người dùng *
                    </label>
                    <select
                      required
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">-- Chọn user --</option>
                      {availableUsers.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || user.email} ({user.email}) - System role: {user.role}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-blue-600 mt-1">
                      Hiển thị {availableUsers.length} user chưa là thành viên
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">
                      Vai trò trong project *
                    </label>
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      {roles.map(role => (
                        <option key={role.name} value={role.name}>
                          {role.display_name} - {role.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="submit"
                      disabled={adding || !selectedUserId}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
                    >
                      {adding ? '⏳ Đang thêm...' : '✅ Thêm thành viên'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMember(false)
                        setSelectedUserId('')
                      }}
                      className="px-4 py-2 border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 transition-colors"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Members List */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">
              Danh sách thành viên ({members.length})
            </h3>

            {members.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <span className="text-4xl mb-2 block">👤</span>
                <p className="text-gray-600">Chưa có thành viên nào trong project</p>
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium">
                          {member.user?.full_name?.charAt(0) || member.user?.email.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {member.user?.full_name || member.user?.email}
                        </p>
                        <p className="text-sm text-gray-600">{member.user?.email}</p>
                        <p className="text-xs text-gray-500">
                          Tham gia: {new Date(member.assigned_at).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {/* Role Badge */}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(member.role)}`}>
                        {getRoleDisplayName(member.role)}
                      </span>

                      {/* Actions */}
                      {userPermissions.can_manage_members && (
                        <div className="flex items-center space-x-2">
                          <select
                            value={member.role}
                            onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            {roles.map(role => (
                              <option key={role.name} value={role.name}>
                                {role.display_name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleRemoveMember(member.id, member.user?.full_name || member.user?.email || '')}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}