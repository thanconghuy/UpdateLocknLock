import React, { useState, useEffect } from 'react'
import { X, UserPlus, Trash2, Loader2 } from 'lucide-react'
import { projectMembersService, ProjectMember, AvailableUser, ProjectRole } from '@/services/projectMembers'
import { useAuth } from '@/contexts/AuthContext'
import { ProjectRoleName } from '@/types/projectRoles'

interface ProjectMembersModalProps {
  projectId: number
  projectName: string
  onClose: () => void
}

export default function ProjectMembersModal({
  projectId,
  projectName,
  onClose
}: ProjectMembersModalProps) {
  const { userProfile } = useAuth()

  // State
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [roles, setRoles] = useState<ProjectRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<ProjectRoleName>('viewer')
  const [isAdding, setIsAdding] = useState(false)

  // Load initial data
  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    if (!userProfile?.id) return

    setLoading(true)
    setError(null)

    try {
      const [membersData, usersData, rolesData] = await Promise.all([
        projectMembersService.getMembers(projectId, userProfile.id),
        projectMembersService.getAvailableUsers(projectId, userProfile.id),
        projectMembersService.getAvailableRoles()
      ])

      setMembers(membersData)
      setAvailableUsers(usersData)
      setRoles(rolesData)
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu')
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId || !userProfile?.id) return

    setIsAdding(true)
    setError(null)

    try {
      await projectMembersService.addMember({
        projectId,
        userId: selectedUserId,
        role: selectedRole
      }, userProfile.id)

      // Reset form
      setSelectedUserId('')
      setSelectedRole('viewer')

      // Reload data
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Không thể thêm thành viên')
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!userProfile?.id) return
    if (!confirm('Bạn có chắc muốn xóa thành viên này?')) return

    setError(null)

    try {
      await projectMembersService.removeMember(memberId, userProfile.id)
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Không thể xóa thành viên')
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: ProjectRoleName) => {
    if (!userProfile?.id) return

    setError(null)

    try {
      await projectMembersService.updateMemberRole({
        memberId,
        newRole
      }, userProfile.id)

      await loadData()
    } catch (err: any) {
      setError(err.message || 'Không thể cập nhật role')
    }
  }

  // Get role display info
  const getRoleInfo = (roleName: string) => {
    const role = roles.find(r => r.name === roleName)
    return {
      display_name: role?.display_name || roleName,
      level: role?.level || 0
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-orange-500 to-red-500">
          <div className="text-white">
            <h2 className="text-2xl font-bold">Quản lý thành viên</h2>
            <p className="text-orange-100 text-sm mt-1">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-orange-100 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto" />
              <p className="mt-4 text-gray-600">Đang tải...</p>
            </div>
          ) : (
            <>
              {/* Add Member Form */}
              <form onSubmit={handleAddMember} className="mb-8 p-6 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                  <UserPlus className="w-5 h-5 mr-2 text-orange-500" />
                  Thêm thành viên mới
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chọn người dùng *
                    </label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      required
                      disabled={isAdding}
                    >
                      <option value="">-- Chọn user --</option>
                      {availableUsers.map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.email} {user.full_name ? `(${user.full_name})` : ''} - {user.system_role}
                        </option>
                      ))}
                    </select>
                    {availableUsers.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">Không có user nào có thể thêm</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vai trò *
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as ProjectRoleName)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                      required
                      disabled={isAdding}
                    >
                      {roles.map(role => (
                        <option key={role.id} value={role.name}>
                          {role.display_name} (Level {role.level})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isAdding || !selectedUserId || availableUsers.length === 0}
                      className="w-full px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      {isAdding ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Đang thêm...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Thêm thành viên
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {/* Members List */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center text-gray-800">
                  <svg className="w-5 h-5 mr-2 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  Danh sách thành viên ({members.length})
                </h3>

                {members.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-gray-500">Chưa có thành viên nào</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map(member => {
                      const roleInfo = getRoleInfo(member.project_role)
                      return (
                        <div
                          key={member.member_id}
                          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-red-400 rounded-full flex items-center justify-center text-white font-bold">
                                {member.user_email.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {member.user_email}
                                </p>
                                {member.user_full_name && (
                                  <p className="text-sm text-gray-600">
                                    {member.user_full_name}
                                  </p>
                                )}
                                <div className="flex items-center space-x-2 mt-1">
                                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                    System: {member.user_system_role}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    Thêm: {new Date(member.created_at).toLocaleDateString('vi-VN')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 ml-4">
                            <select
                              value={member.project_role}
                              onChange={(e) => handleUpdateRole(member.member_id, e.target.value as ProjectRoleName)}
                              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white min-w-[160px]"
                            >
                              {roles.map(role => (
                                <option key={role.id} value={role.name}>
                                  {role.display_name} (L{role.level})
                                </option>
                              ))}
                            </select>

                            <button
                              onClick={() => handleRemoveMember(member.member_id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Xóa thành viên"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
