import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useProject } from '../../contexts/ProjectContext'

export default function UserRoleDebug() {
  const { userProfile, isAdmin, isEditor, isViewer } = useAuth()
  const { currentProject } = useProject()

  // Only show in development mode
  if (import.meta.env.PROD) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-90 text-white text-xs p-3 rounded-lg shadow-lg max-w-xs z-50">
      <div className="font-bold mb-2 text-yellow-400">🔍 Debug Info</div>
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">User:</span> {userProfile?.full_name || 'N/A'}
        </div>
        <div>
          <span className="text-gray-400">Email:</span> {userProfile?.email || 'N/A'}
        </div>
        <div>
          <span className="text-gray-400">Role:</span> {userProfile?.role || 'N/A'}
        </div>
        <div>
          <span className="text-gray-400">Permissions:</span>
          <div className="ml-2">
            {isAdmin() && <span className="text-red-400">✓ Admin</span>}
            {isEditor() && <span className="text-blue-400">✓ Editor</span>}
            {isViewer() && <span className="text-green-400">✓ Viewer</span>}
          </div>
        </div>
        <div>
          <span className="text-gray-400">Project:</span> {currentProject?.name || 'N/A'}
        </div>
        <div>
          <span className="text-gray-400">Project ID:</span> {currentProject?.project_id || 'N/A'}
        </div>
      </div>
    </div>
  )
}
