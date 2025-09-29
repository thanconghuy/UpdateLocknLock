import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useProject } from '../../contexts/ProjectContext'
import { UserRole } from '../../types/auth'

interface HeaderProps {
  route: 'dashboard' | 'import' | 'products' | 'logs' | 'admin' | 'projects'
  setRoute: (route: 'dashboard' | 'import' | 'products' | 'logs' | 'admin' | 'projects') => void
}

export default function Header({ route, setRoute }: HeaderProps) {
  const { user, userProfile, logout } = useAuth()
  const { currentProject, projects, switchProject, setShowProjectSelector } = useProject()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showProjectMenu, setShowProjectMenu] = useState(false)

  const handleLogout = async () => {
    await logout()
    setShowUserMenu(false)
  }

  const getUserDisplayName = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name
    }
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
    }
    if (user?.user_metadata?.display_name) {
      return user.user_metadata.display_name
    }
    return user?.email?.split('@')[0] || 'User'
  }

  // Cache admin status to survive userProfile reloads
  const isAdmin = userProfile?.role === UserRole.ADMIN

  // Save admin status to localStorage when we know it
  React.useEffect(() => {
    if (userProfile?.role && user?.email) {
      localStorage.setItem(`adminStatus_${user.email}`, userProfile.role)
    }
  }, [userProfile?.role, user?.email])

  // Fallback: Use cached admin status if userProfile not loaded yet
  const cachedRole = user?.email ? localStorage.getItem(`adminStatus_${user.email}`) : null
  const isAdminWithFallback = isAdmin || (cachedRole === 'admin')

  // Debug admin status
  console.log('🔍 Header admin check:', {
    userProfileLoaded: !!userProfile,
    userRole: userProfile?.role,
    cachedRole,
    isAdmin,
    isAdminWithFallback,
    userEmail: user?.email
  })

  return (
    <header className="p-4 border-b bg-white neo-panel">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">WP Product Management</h1>

          {/* Project Selector */}
          {currentProject ? (
            <div className="relative">
              <button
                onClick={() => setShowProjectMenu(!showProjectMenu)}
                className="flex items-center space-x-2 text-sm bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-3 py-2 transition-colors"
              >
                <span className="font-medium text-blue-800">{currentProject.name}</span>
                <svg
                  className={`w-4 h-4 text-blue-600 transition-transform ${showProjectMenu ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showProjectMenu && (
                <div className="absolute left-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">Chọn Project</p>
                    <p className="text-xs text-gray-500">{projects.length} projects</p>
                  </div>

                  <div className="max-h-64 overflow-y-auto">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => {
                          switchProject(project.id)
                          setShowProjectMenu(false)
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between ${
                          currentProject.id === project.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${
                            currentProject.id === project.id ? 'text-blue-900' : 'text-gray-900'
                          }`}>
                            {project.name}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {project.woocommerce_base_url.replace(/https?:\/\//, '')}
                          </p>
                        </div>
                        {currentProject.id === project.id && (
                          <span className="text-blue-600">✓</span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-2">
                    <button
                      onClick={() => {
                        setRoute('projects')
                        setShowProjectMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50"
                    >
                      ⚙️ Quản lý Projects
                    </button>
                    <button
                      onClick={() => {
                        setShowProjectSelector(true)
                        setShowProjectMenu(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                    >
                      ➕ Tạo Project Mới
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              No project selected
            </div>
          )}
        </div>

        <nav className="flex gap-3 items-center">
          {/* Navigation Buttons */}
          <button
            className={`px-3 py-1 ${route === 'dashboard' ? 'neo-btn primary' : 'neo-btn'}`}
            onClick={() => setRoute('dashboard')}
          >
            🏠 Dashboard
          </button>
          <button
            className={`px-3 py-1 ${route === 'products' ? 'neo-btn primary' : 'neo-btn'}`}
            onClick={() => setRoute('products')}
          >
            📦 Products
          </button>
          <button
            className={`px-3 py-1 ${route === 'logs' ? 'neo-btn primary' : 'neo-btn'}`}
            onClick={() => setRoute('logs')}
          >
            📊 Logs
          </button>
          <button
            className={`px-3 py-1 ${route === 'import' ? 'neo-btn primary' : 'neo-btn'}`}
            onClick={() => setRoute('import')}
          >
            📤 Import
          </button>
          <button
            className={`px-3 py-1 ${route === 'projects' ? 'neo-btn primary' : 'neo-btn'}`}
            onClick={() => setRoute('projects')}
          >
            🏢 Projects
          </button>

          {/* Admin Settings - Only show for admin users */}
          {isAdminWithFallback && (
            <button
              className={`px-3 py-1 ${route === 'admin' ? 'neo-btn primary' : 'neo-btn'} border-red-300 text-red-700 hover:bg-red-50`}
              onClick={() => setRoute('admin')}
              title="System Settings (Admin Only)"
            >
              ⚙️ Admin
            </button>
          )}

          {/* User Menu */}
          <div className="relative ml-4">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
            >
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                {getUserDisplayName().charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium">{getUserDisplayName()}</span>
              <svg
                className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">{getUserDisplayName()}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  <div className="mt-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      ✅ Authenticated
                    </span>
                  </div>
                </div>

                {/* Regular settings for all users */}
                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    // TODO: Add user settings page navigation
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  ⚙️ Cài đặt người dùng
                </button>

                {/* Admin-only system settings */}
                {isAdminWithFallback && (
                  <button
                    onClick={() => {
                      setRoute('admin')
                      setShowUserMenu(false)
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 border-l-2 border-red-300"
                  >
                    🔒 Cài đặt hệ thống
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowUserMenu(false)
                    // TODO: Add profile page navigation
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  👤 Hồ sơ
                </button>

                <div className="border-t border-gray-200 mt-1">
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                  >
                    🚪 Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Click outside to close menus */}
      {(showUserMenu || showProjectMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowUserMenu(false)
            setShowProjectMenu(false)
          }}
        />
      )}
    </header>
  )
}