import React, { useState, useEffect } from 'react'
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
  const [profileLoadTimeout, setProfileLoadTimeout] = useState(false)

  // CRITICAL: Check if we're in password recovery mode
  // If yes, show login page (don't auto-authenticate with recovery session)
  const isRecoveryMode = () => {
    if (typeof window === 'undefined') return false
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const searchParams = new URLSearchParams(window.location.search)
    const type = hashParams.get('type') || searchParams.get('type')
    return type === 'recovery'
  }

  // If authenticated but profile not loaded yet, set up timeout to refresh profile
  useEffect(() => {
    if (user && !userProfile) {
      const timeout = setTimeout(async () => {
        console.warn('⚠️ Profile loading timeout - attempting to refresh profile')
        setProfileLoadTimeout(true)
        // Try to refresh profile one more time
        try {
          await refreshProfile()
        } catch (err) {
          console.warn('⚠️ Profile refresh failed, will proceed with temporary profile if available')
        }
      }, 3000) // 3 second timeout
      return () => clearTimeout(timeout)
    } else {
      setProfileLoadTimeout(false)
    }
  }, [user, userProfile, refreshProfile])

  if (isRecoveryMode()) {
    console.log('🔐 Recovery mode detected in ProtectedRoute - showing login page')
    return <LoginPage />
  }

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

  if (user && !userProfile && !profileLoadTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-gray-800 mb-2">Loading Profile...</h2>
          <p className="text-gray-600">Please wait while we load your user profile</p>
          <div className="mt-4 text-xs text-gray-500">
            This should only take a few seconds...
          </div>
        </div>
      </div>
    )
  }

  // If profile timeout but user exists, allow UI to proceed
  // AuthContext should have set temporary profile by now
  // If not, we'll proceed anyway to avoid infinite loading
  if (user && !userProfile && profileLoadTimeout) {
    console.warn('⚠️ Profile load timeout exceeded - allowing UI to proceed')
    console.warn('💡 AuthContext should have set temporary profile - if not, it will be set on next render')
    // Continue to next checks - if userProfile is still null, it will be handled by AuthContext
    // This prevents infinite "Loading Profile..." screen
  }

  // If user account is not active, show pending approval page
  // Note: userProfile might be temporary profile at this point
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
          await refreshProfile()
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
