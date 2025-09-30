// =======================================
// PENDING APPROVAL PAGE - For New Users
// =======================================

import React from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface PendingApprovalPageProps {
  userEmail?: string
  userName?: string
}

export default function PendingApprovalPage({ userEmail, userName }: PendingApprovalPageProps) {
  const { logout } = useAuth()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full">
        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          {/* Welcome Icon */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mb-6">
            <span className="text-3xl text-white">👋</span>
          </div>

          {/* Welcome Message */}
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Chào mừng {userName || userEmail || 'bạn'}!
          </h1>

          <div className="space-y-4 text-gray-600">
            <p className="text-lg">
              🎉 <strong>Đăng nhập thành công!</strong>
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-yellow-500 text-xl mr-3">⏳</span>
                <div className="text-left">
                  <p className="font-medium text-yellow-800 mb-2">
                    Tài khoản đang chờ phê duyệt
                  </p>
                  <p className="text-sm text-yellow-700">
                    Vui lòng chờ xác nhận của Admin về quyền quản trị của bạn và quay lại sau!
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
                    Trạng thái: <span className="text-yellow-600 font-medium">Chờ phê duyệt</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-gray-500 text-xl mr-3">ℹ️</span>
                <div className="text-left">
                  <p className="font-medium text-gray-800 mb-2">
                    Tiếp theo cần làm gì?
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Admin sẽ xem xét và phê duyệt tài khoản của bạn</li>
                    <li>• Bạn sẽ nhận được email thông báo khi được kích hoạt</li>
                    <li>• Sau đó có thể đăng nhập và sử dụng đầy đủ tính năng</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleLogout}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            🚪 Đăng xuất
          </button>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Có thắc mắc? Liên hệ admin qua email hoặc hệ thống support
            </p>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-4">
          <div className="text-center">
            <h3 className="text-sm font-medium text-gray-800 mb-2">
              🔒 WP Product Management Tool
            </h3>
            <p className="text-xs text-gray-500">
              Hệ thống quản lý sản phẩm WordPress an toàn và hiệu quả
            </p>
          </div>
        </div>

        {/* Refresh Notice */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            💡 Mẹo: Bạn có thể thử đăng nhập lại sau khi nhận được email phê duyệt
          </p>
        </div>
      </div>
    </div>
  )
}