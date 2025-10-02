import React, { useState, useEffect } from 'react'
import { useProject } from '../../contexts/ProjectContext'
import { useAuth } from '../../contexts/AuthContext'
import { Project, UpdateProjectData } from '../../types/project'
import DeletedProjectBanner from './DeletedProjectBanner'
import ProjectMembersModal from './ProjectMembersModal'

interface ProjectManagementProps {
  onClose?: () => void
}

export default function ProjectManagement({ onClose }: ProjectManagementProps) {
  const {
    currentProject,
    projects,
    updateProject,
    deleteProject,
    loadProjects
  } = useProject()

  const { userProfile } = useAuth()

  // Debug user role
  console.log('🔍 ProjectManagement debug:', {
    userRole: userProfile?.role,
    projectsCount: projects?.length,
    projects: projects?.map(p => ({ name: p.name, isActive: p.is_active, deletedAt: p.deleted_at }))
  })

  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState<Partial<UpdateProjectData>>({})
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showMemberManagement, setShowMemberManagement] = useState<{ projectId: number, projectName: string } | null>(null)

  // Reset form when editing project changes
  useEffect(() => {
    if (editingProject) {
      setFormData({
        name: editingProject.name,
        description: editingProject.description || '',
        woocommerce_base_url: editingProject.woocommerce_base_url,
        woocommerce_consumer_key: editingProject.woocommerce_consumer_key,
        woocommerce_consumer_secret: editingProject.woocommerce_consumer_secret,
        products_table: 'products_new',
        audit_table: 'product_updates',
        is_active: editingProject.is_active
      })
    }
  }, [editingProject])

  const handleEdit = (project: Project) => {
    setEditingProject(project)
  }

  const handleCancelEdit = () => {
    setEditingProject(null)
    setFormData({})
  }

  const handleSave = async () => {
    if (!editingProject || !formData.name?.trim()) {
      return
    }

    try {
      setSaving(true)

      const updateData: UpdateProjectData = {
        id: editingProject.id,
        ...formData
      }

      console.log('🔍 ProjectManagement handleSave:', {
        editingProjectId: editingProject.id,
        editingProjectName: editingProject.name,
        updateData,
        formData
      })

      const success = await updateProject(updateData)

      if (success) {
        console.log('✅ Project updated successfully')
        setEditingProject(null)
        setFormData({})

        // Reload projects to get fresh data
        await loadProjects()
      } else {
        console.error('❌ Failed to update project')
      }
    } catch (error) {
      console.error('❌ Exception updating project:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (projectId: string) => {
    if (!projectId || projectId !== showDeleteConfirm) {
      return
    }

    try {
      setDeleting(true)

      const success = await deleteProject(projectId)

      if (success) {
        console.log('✅ Project deleted successfully')
        setShowDeleteConfirm(null)
      } else {
        console.error('❌ Failed to delete project')
      }
    } catch (error) {
      console.error('❌ Exception deleting project:', error)
    } finally {
      setDeleting(false)
    }
  }

  const canEditProject = (project: any) => {
    // User can edit if they are:
    // 1. System admin
    // 2. Project owner
    // 3. Project admin/manager
    return userProfile?.role === 'admin' ||
           project.owner_id === userProfile?.id ||
           project.user_role === 'admin' ||
           project.user_role === 'manager'
  }

  const canDeleteProject = (project: any) => {
    // Debug: Always allow delete for testing
    // TODO: Restore proper permissions after debug
    console.log('🔍 Debug delete permissions:', {
      userRole: userProfile?.role,
      userId: userProfile?.id,
      projectOwnerId: project.owner_id
    })

    // Temporary: Allow delete for testing
    return true

    // Original check:
    // return userProfile?.role === 'admin' ||
    //        project.owner_id === userProfile?.id
  }

  // Calculate project statistics
  const projectStats = {
    total: projects.length,
    active: projects.filter(p => p.is_active && !p.deleted_at).length,
    inactive: projects.filter(p => !p.is_active && !p.deleted_at).length,
    deleted: projects.filter(p => !!p.deleted_at).length
  }

  const hasProjects = projects.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quản Trị Projects</h2>
          <p className="text-gray-600">Quản lý, chỉnh sửa và xóa projects</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <span className="text-2xl">✕</span>
          </button>
        )}
      </div>

      {/* Project Statistics Overview */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-xl">📊</span>
          Tổng quan Projects
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Projects */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tổng số</p>
                <p className="text-2xl font-bold text-gray-900">{projectStats.total}</p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📁</span>
              </div>
            </div>
          </div>

          {/* Active Projects */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Hoạt động</p>
                <p className="text-2xl font-bold text-green-900">{projectStats.active}</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🟢</span>
              </div>
            </div>
          </div>

          {/* Inactive Projects */}
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-700">Tạm dừng</p>
                <p className="text-2xl font-bold text-yellow-900">{projectStats.inactive}</p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">⏸️</span>
              </div>
            </div>
          </div>

          {/* Deleted Projects */}
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Chờ xóa (7 ngày)</p>
                <p className="text-2xl font-bold text-red-900">{projectStats.deleted}</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">🗑️</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="grid grid-cols-1 gap-6">
        {hasProjects ? (
          projects.map((project) => {
          const isDeleted = !!project.deleted_at
          const isInactive = !project.is_active && !isDeleted
          const isExpired = isDeleted && new Date(project.deleted_at!) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

          return (
            <div
              key={project.id}
              className={`rounded-lg shadow-sm border-2 transition-all ${
                isDeleted
                  ? 'bg-red-50 border-red-200' // Deleted projects have red background
                  : isInactive
                  ? 'bg-yellow-50 border-yellow-200' // Inactive projects have yellow background
                  : currentProject?.id === project.id
                  ? 'bg-white border-blue-500 ring-2 ring-blue-100'
                  : 'bg-white border-gray-200'
              }`}
            >
            {/* Only disable editing for deleted projects, allow editing inactive projects */}
            {editingProject?.id === project.id && !isDeleted ? (
              /* EDIT MODE */
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Chỉnh sửa Project
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                      disabled={saving}
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !formData.name?.trim()}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                    >
                      {saving ? '⏳ Đang lưu...' : '💾 Lưu'}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tên Project *
                      </label>
                      <input
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Nhập tên project..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Trạng thái
                      </label>
                      <select
                        value={formData.is_active ? 'active' : 'inactive'}
                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'active' }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="active">🟢 Hoạt động</option>
                        <option value="inactive">🔴 Tạm dừng</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mô tả
                    </label>
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Mô tả về project..."
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        WooCommerce URL *
                      </label>
                      <input
                        type="url"
                        value={formData.woocommerce_base_url || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, woocommerce_base_url: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://yourstore.com"
                      />
                    </div>

                    {/* Products Table field removed - now hardcoded to use products_new */}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Consumer Key *
                      </label>
                      <input
                        type="password"
                        value={formData.woocommerce_consumer_key || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, woocommerce_consumer_key: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="ck_xxxxxxxxxxxxxxxxxxxxx"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Consumer Secret *
                      </label>
                      <input
                        type="password"
                        value={formData.woocommerce_consumer_secret || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, woocommerce_consumer_secret: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        placeholder="cs_xxxxxxxxxxxxxxxxxxxxx"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* VIEW MODE */
              <div className="p-6">
                {/* Show deleted project banner if project is soft-deleted */}
                {isDeleted && (
                  <DeletedProjectBanner
                    project={project}
                    onRestore={() => {
                      console.log('Project restored, reloading...')
                      loadProjects()
                    }}
                    onPermanentDelete={() => {
                      console.log('Project permanently deleted, reloading...')
                      loadProjects()
                    }}
                  />
                )}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {project.name}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isDeleted
                          ? 'bg-red-100 text-red-800'
                          : isInactive
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {isDeleted ? '🗑️ Đã xóa' : isInactive ? '⏸️ Tạm dừng' : '🟢 Hoạt động'}
                      </span>
                      {currentProject?.id === project.id && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          ⭐ Đang chọn
                        </span>
                      )}
                    </div>

                    {project.description && (
                      <p className="text-gray-600 mb-3">{project.description}</p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex items-center text-gray-600">
                          <span className="w-24 font-medium">WooCommerce:</span>
                          <span className="text-blue-600">
                            {project.woocommerce_base_url.replace(/https?:\/\//, '')}
                          </span>
                        </div>
                        {/* Database table info removed - now uses standardized products_new */}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center text-gray-600">
                          <span className="w-24 font-medium">Thành viên:</span>
                          <span>{project.member_count || 0}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <span className="w-24 font-medium">Tạo lúc:</span>
                          <span>{new Date(project.created_at).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {/* Member Management Button */}
                    {!isDeleted && (
                      <button
                        onClick={() => setShowMemberManagement({ projectId: project.project_id, projectName: project.name })}
                        className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      >
                        👥 Thành viên
                      </button>
                    )}

                    {/* Only disable edit button for deleted projects, allow editing inactive projects */}
                    {!isDeleted && canEditProject(project) && (
                      <button
                        onClick={() => handleEdit(project)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        ✏️ Sửa
                      </button>
                    )}

                    {!isDeleted && canDeleteProject(project) && (
                      <button
                        onClick={() => setShowDeleteConfirm(project.id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        🗑️ Xóa
                      </button>
                    )}

                    {/* Status hints */}
                    {isDeleted && (
                      <div className="text-xs text-red-600 italic">
                        Các tùy chọn khôi phục/xóa vĩnh viễn ở phía trên
                      </div>
                    )}
                    {isInactive && (
                      <div className="text-xs text-yellow-600 italic">
                        Project tạm dừng - Có thể sửa để chuyển lại trạng thái hoạt động
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          )
        })
        ) : (
          /* Empty State */
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-4xl">🏢</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Chưa có project nào
            </h3>
            <p className="text-gray-500">
              Tạo project đầu tiên để bắt đầu quản lý
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <span className="text-red-500 text-2xl mr-3">⚠️</span>
              <h3 className="text-lg font-semibold text-gray-900">
                Xác nhận xóa Project
              </h3>
            </div>

            <p className="text-gray-600 mb-6">
              Bạn có chắc chắn muốn xóa project này? Project sẽ được chuyển vào thùng rác và có thể khôi phục trong vòng 7 ngày.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={deleting}
              >
                Hủy
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300"
              >
                {deleting ? '⏳ Đang xóa...' : '🗑️ Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Member Management Modal */}
      {showMemberManagement && (
        <ProjectMembersModal
          projectId={showMemberManagement.projectId}
          projectName={showMemberManagement.projectName}
          onClose={() => setShowMemberManagement(null)}
        />
      )}
    </div>
  )
}