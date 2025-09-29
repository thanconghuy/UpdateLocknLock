import React, { useState } from 'react'
import { AlertTriangle, RefreshCw, Trash2, Clock } from 'lucide-react'
import { Project } from '../../types/project'
import { ProjectService } from '../../services/projectService'
import { useProject } from '../../contexts/ProjectContext'

interface DeletedProjectBannerProps {
  project: Project
  onRestore?: () => void
  onPermanentDelete?: () => void
}

export const DeletedProjectBanner: React.FC<DeletedProjectBannerProps> = ({
  project,
  onRestore,
  onPermanentDelete
}) => {
  const [isRestoring, setIsRestoring] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirmPermanent, setShowConfirmPermanent] = useState(false)

  const { deleteProject: contextDeleteProject, restoreProject } = useProject()

  // Calculate days remaining
  const deletedAt = new Date(project.deleted_at!)
  const daysRemaining = Math.max(0, 7 - Math.floor((Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)))

  const handleRestore = async () => {
    if (isRestoring) return

    setIsRestoring(true)
    try {
      console.log('🔄 Restoring project via ProjectContext:', project.id)
      const success = await restoreProject(project.id)
      if (success && onRestore) {
        onRestore()
      }
    } catch (error) {
      console.error('Error restoring project:', error)
    } finally {
      setIsRestoring(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (isDeleting) return

    setIsDeleting(true)
    try {
      console.log('🔥 STARTING permanent delete from DeletedProjectBanner')
      console.log('🎯 Target project:', {
        id: project.id,
        name: project.name,
        deleted_at: project.deleted_at,
        is_active: project.is_active
      })

      console.log('🔄 Calling ProjectContext.deleteProject with permanent=true...')
      const success = await contextDeleteProject(project.id, true) // Use ProjectContext permanent delete

      console.log('🔍 Permanent delete result:', success)

      if (success) {
        console.log('✅ Permanent delete SUCCESS - calling onPermanentDelete callback')
        if (onPermanentDelete) {
          onPermanentDelete()
        }
      } else {
        console.error('❌ Permanent delete FAILED - ProjectContext returned false')
      }
    } catch (error) {
      console.error('💥 EXCEPTION in permanent delete:', error)
    } finally {
      setIsDeleting(false)
      setShowConfirmPermanent(false)
      console.log('🏁 DeletedProjectBanner permanent delete completed')
    }
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-red-800">
              Project đã bị xóa
            </h3>

            <div className="flex items-center space-x-2 text-xs text-red-600">
              <Clock className="w-4 h-4" />
              <span>Còn {daysRemaining} ngày để khôi phục</span>
            </div>
          </div>

          <p className="text-sm text-red-700 mt-1">
            Project này đã bị xóa vào {deletedAt.toLocaleDateString('vi-VN')} lúc {deletedAt.toLocaleTimeString('vi-VN')}.
            {daysRemaining > 0 ? (
              ` Bạn có thể khôi phục trong vòng ${daysRemaining} ngày, sau đó project sẽ bị xóa vĩnh viễn.`
            ) : (
              ' Project này sẽ bị xóa vĩnh viễn trong vài giờ tới.'
            )}
          </p>

          <div className="flex items-center space-x-3 mt-3">
            {daysRemaining > 0 && (
              <button
                onClick={handleRestore}
                disabled={isRestoring}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-md transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isRestoring ? 'animate-spin' : ''}`} />
                {isRestoring ? 'Đang khôi phục...' : 'Khôi phục'}
              </button>
            )}

            <button
              onClick={() => setShowConfirmPermanent(true)}
              disabled={isDeleting}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Xóa vĩnh viễn
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmPermanent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Xác nhận xóa vĩnh viễn</h3>
                <p className="text-sm text-gray-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-6">
              Bạn có chắc chắn muốn xóa vĩnh viễn project "<strong>{project.name}</strong>" không?
              Tất cả dữ liệu bao gồm sản phẩm, cấu hình WooCommerce và thành viên sẽ bị xóa hoàn toàn.
            </p>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowConfirmPermanent(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                Hủy
              </button>

              <button
                onClick={handlePermanentDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:bg-red-400"
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DeletedProjectBanner