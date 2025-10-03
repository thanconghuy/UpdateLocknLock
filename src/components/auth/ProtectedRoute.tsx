import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useProject } from '../../contexts/ProjectContext'
import LoginPage from './LoginPage'
import PendingApprovalPage from './PendingApprovalPage'
import NoProjectAccessPage from './NoProjectAccessPage'
import ChangePasswordPage from './ChangePasswordPage'
import UpdatePasswordPage from './UpdatePasswordPage'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userProfile, loading, refreshProfile } = useAuth()
  const { projects, loading: projectsLoading } = useProject()
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  // Check if user is in password recovery mode (from email link)
  useEffect(() => {
    // Check both URL hash and query string for recovery token
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const searchParams = new URLSearchParams(window.location.search)

    const typeFromHash = hashParams.get('type')
    const typeFromQuery = searchParams.get('type')

    console.log('🔍 Checking recovery mode...')
    console.log('  Hash params:', window.location.hash)
    console.log('  Query params:', window.location.search)
    console.log('  Type from hash:', typeFromHash)
    console.log('  Type from query:', typeFromQuery)

    if (typeFromHash === 'recovery' || typeFromQuery === 'recovery') {
      console.log('🔐 Password recovery mode detected from email link')
      setIsPasswordRecovery(true)
    }
  }, [])

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

  // If user is in password recovery mode (from email link), show update password page
  if (isPasswordRecovery && user) {
    return (
      <UpdatePasswordPage
        onComplete={() => {
          setIsPasswordRecovery(false)
          // Clear URL hash and query params
          window.history.replaceState(null, '', window.location.pathname)
          // Force reload to go back to normal flow
          window.location.href = '/'
        }}
      />
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