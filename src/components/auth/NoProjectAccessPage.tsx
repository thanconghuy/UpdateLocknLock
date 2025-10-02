// =======================================
// NO PROJECT ACCESS PAGE
// =======================================
// Hiển thị khi user đã active nhưng chưa được assign vào project nào

import React from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface NoProjectAccessPageProps {
  userEmail?: string
  userName?: string
}

export default function NoProjectAccessPage({ userEmail, userName }: NoProjectAccessPageProps) {
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full">
        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center mb-6">
            <span className="text-3xl text-white">🔒</span>
          </div>

          {/* Message */}
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Chào {userName || userEmail || 'bạn'}!
          </h1>

          <div className="space-y-4 text-gray-600">
            <p className="text-lg">
              ✅ <strong>Tài khoản đã được kích hoạt</strong>
            </p>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-orange-500 text-xl mr-3">⚠️</span>
                <div className="text-left">
                  <p className="font-medium text-orange-800 mb-2">
                    Chưa có quyền truy cập dự án
                  </p>
                  <p className="text-sm text-orange-700">
                    Bạn chưa được phân quyền quản lý bất kỳ dự án (project) nào trong hệ thống <strong>Lock & Lock Product Management Tool</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-blue-500 text-xl mr-3">📧</span>
                <div className="text-left">
                  <p className="font-medium text-blue-800 mb-1">
                    Thông tin tài khoản
                  </p>
                  <p className="text-sm text-blue-700">
                    Email: <span className="font-mono">{userEmail}</span>
                  </p>
                  <p className="text-sm text-blue-700">
                    Trạng thái: <span className="text-green-600 font-medium">✅ Active</span>
                  </p>
                  <p className="text-sm text-blue-700">
                    Quyền truy cập: <span className="text-orange-600 font-medium">⚠️ Chưa có project</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-gray-500 text-xl mr-3">ℹ️</span>
                <div className="text-left">
                  <p className="font-medium text-gray-800 mb-2">
                    Cần làm gì tiếp theo?
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Liên hệ với <strong>Project Manager</strong> hoặc <strong>Admin</strong></li>
                    <li>• Yêu cầu được thêm vào project bạn cần làm việc</li>
                    <li>• Admin sẽ assign bạn vào project phù hợp với vai trò</li>
                    <li>• Sau khi được thêm, đăng nhập lại để truy cập</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            🔄 Refresh / Kiểm tra lại
          </button>

          <button
            onClick={handleLogout}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            🚪 Đăng xuất
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Có thắc mắc? Liên hệ Admin hoặc Project Manager
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-4">
          <div className="text-center">
            <h3 className="text-sm font-medium text-gray-800 mb-2">
              🔒 Lock & Lock Product Management Tool
            </h3>
            <p className="text-xs text-gray-500">
              Hệ thống quản lý sản phẩm WordPress - Phân quyền theo dự án
            </p>
          </div>
        </div>

        {/* Tip */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            💡 Mẹo: Admin có thể thêm bạn vào project trong Admin Settings → Users
          </p>
        </div>
      </div>
    </div>
  )
}