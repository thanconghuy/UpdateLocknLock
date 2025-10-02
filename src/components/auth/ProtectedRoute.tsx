import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useProject } from '../../contexts/ProjectContext'
import LoginPage from './LoginPage'
import PendingApprovalPage from './PendingApprovalPage'
import NoProjectAccessPage from './NoProjectAccessPage'
import ChangePasswordPage from './ChangePasswordPage'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userProfile, loading, refreshProfile } = useAuth()
  const { projects, loading: projectsLoading } = useProject()
  const [passwordChanged, setPasswordChanged] = useState(false)

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-gray-800 mb-2">Authenticating...</h2>
          <p className="text-gray-600">Please wait while we verify your credentials</p>
          <div className="mt-4 text-xs text-gray-500">
            If this takes too long, try refreshing the page
          </div>
        </div>
      </div>
    )
  }

  // If not authenticated, show login page
  if (!user) {
    return <LoginPage />
  }

  // If authenticated but profile not loaded yet, show loading
  if (user && !userProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-gray-800 mb-2">Loading Profile...</h2>
          <p className="text-gray-600">Please wait while we load your user profile</p>
        </div>
      </div>
    )
  }

  // If user account is not active, show pending approval page
  if (userProfile && !userProfile.is_active) {
    console.log('🔒 User account is inactive, showing pending approval page')
    return (
      <PendingApprovalPage
        userEmail={userProfile.email}
        userName={userProfile.full_name}
      />
    )
  }

  // If user must change password, show change password page
  if (userProfile && userProfile.must_change_password && !passwordChanged) {
    console.log('🔐 User must change password, showing change password page')
    return (
      <ChangePasswordPage
        userEmail={userProfile.email}
        onPasswordChanged={async () => {
          setPasswordChanged(true)
          await refreshProfile() // Refresh profile to get updated must_change_password flag
        }}
      />
    )
  }

  // Wait for projects to load (only for non-admin users)
  if (userProfile && userProfile.is_active && userProfile.role !== 'admin' && projectsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-gray-800 mb-2">Loading Projects...</h2>
          <p className="text-gray-600">Please wait while we load your projects</p>
        </div>
      </div>
    )
  }

  // Check if non-admin user has any projects
  if (userProfile && userProfile.is_active && userProfile.role !== 'admin' && !projectsLoading) {
    if (projects.length === 0) {
      console.log('⚠️ User has no projects, showing no project access page')
      return (
        <NoProjectAccessPage
          userEmail={userProfile.email}
          userName={userProfile.full_name}
        />
      )
    }
  }

  // If authenticated and active, render the protected content
  return <>{children}</>
}