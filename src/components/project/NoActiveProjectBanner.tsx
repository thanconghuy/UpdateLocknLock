import React from 'react'
import { AlertTriangle, Settings } from 'lucide-react'

interface NoActiveProjectBannerProps {
  onManageProjects: () => void
}

export const NoActiveProjectBanner: React.FC<NoActiveProjectBannerProps> = ({
  onManageProjects
}) => {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="w-6 h-6 text-yellow-500 mt-0.5 flex-shrink-0" />

        <div className="flex-1">
          <h3 className="text-lg font-medium text-yellow-800 mb-2">
            Không có project khả dụng
          </h3>

          <p className="text-sm text-yellow-700 mb-4">
            Project hiện tại đang ở trạng thái tạm dừng hoặc đã bị xóa.
            Vui lòng kích hoạt project hoặc chọn project khác để tiếp tục sử dụng.
          </p>

          <div className="flex space-x-3">
            <button
              onClick={onManageProjects}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded-md transition-colors"
            >
              <Settings className="w-4 h-4 mr-2" />
              Quản lý Projects
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NoActiveProjectBanner