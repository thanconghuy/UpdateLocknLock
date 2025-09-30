import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import LoginPage from './LoginPage'
import PendingApprovalPage from './PendingApprovalPage'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, userProfile, loading } = useAuth()

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

  // If authenticated and active, render the protected content
  return <>{children}</>
}