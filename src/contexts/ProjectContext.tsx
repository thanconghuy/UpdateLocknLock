import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { Project, ProjectWithMembers, CreateProjectData } from '../types/project'
import { ProjectService } from '../services/projectService'
// TODO: Import new ProjectMembersService in Phase 3
// import { ProjectMembersService, type UserPermissions } from '../services/projectMembers/ProjectMembersService'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

// Temporary UserPermissions type (will be replaced in Phase 3)
export interface UserPermissions {
  can_manage_members: boolean
  can_edit_project: boolean
  can_delete_project: boolean
  can_manage_woocommerce: boolean
  can_edit_products: boolean
  can_view_analytics: boolean
}

interface ProjectContextType {
  // Current project state
  currentProject: Project | null
  projects: ProjectWithMembers[]
  loading: boolean
  currentProjectPermissions: UserPermissions
  userRole: string

  // Actions
  setCurrentProject: (project: Project | null) => void
  loadProjects: (includeDeleted?: boolean) => Promise<void>
  createProject: (projectData: CreateProjectData) => Promise<Project | null>
  updateProject: (updates: Partial<Project>) => Promise<boolean>
  deleteProject: (projectId: string, permanent?: boolean) => Promise<boolean>
  restoreProject: (projectId: string) => Promise<boolean>
  switchProject: (projectId: string) => Promise<void>

  // Permission helpers
  checkPermission: (permission: keyof UserPermissions) => boolean
  canManageProject: () => boolean

  // Project selection state
  showProjectSelector: boolean
  setShowProjectSelector: (show: boolean) => void
}

const ProjectContext = createContext<ProjectContextType>({
  currentProject: null,
  projects: [],
  loading: true,
  currentProjectPermissions: {
    can_manage_members: false,
    can_edit_project: false,
    can_delete_project: false,
    can_manage_woocommerce: false,
    can_edit_products: false,
    can_view_analytics: false
  },
  userRole: 'none',
  setCurrentProject: () => {},
  loadProjects: async () => {},
  createProject: async () => null,
  updateProject: async () => false,
  deleteProject: async () => false,
  restoreProject: async () => false,
  switchProject: async () => {},
  checkPermission: () => false,
  canManageProject: () => false,
  showProjectSelector: false,
  setShowProjectSelector: () => {}
})

export const useProject = () => {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}

interface ProjectProviderProps {
  children: ReactNode
}

const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [showProjectSelector, setShowProjectSelector] = useState(false)
  const [currentProjectPermissions, setCurrentProjectPermissions] = useState<UserPermissions>({
    can_manage_members: false,
    can_edit_project: false,
    can_delete_project: false,
    can_manage_woocommerce: false,
    can_edit_products: false,
    can_view_analytics: false
  })
  const [userRole, setUserRole] = useState<string>('none')

  const { user, userProfile } = useAuth()

  // Use refs to track previous values to prevent unnecessary reloads
  const prevUserIdRef = useRef<string>()
  const prevUserRoleRef = useRef<string>()
  const loadingProjectsRef = useRef(false)

  // Load all projects for current user (including deleted projects for admin/manager)
  const loadProjects = async (includeDeleted: boolean = false) => {
    if (!user?.id) {
      console.log('❌ No user ID, clearing projects')
      setProjects([])
      setCurrentProject(null)
      setLoading(false)
      return
    }

    // Prevent concurrent loading
    if (loadingProjectsRef.current) {
      console.log('⏳ Already loading projects, skipping...')
      return
    }

    try {
      loadingProjectsRef.current = true
      setLoading(true)
      console.log('🔄 ProjectContext: Starting loadProjects for user:', user.email)
      console.log('🔍 User state:', { id: user.id, email: user.email })
      console.log('🔍 UserProfile state:', userProfile)

      // For admin/manager users, ALWAYS include deleted projects (unless explicitly requested not to)
      // If userProfile not loaded yet, assume admin for safety (will reload when profile loads)
      const userRole = userProfile?.role || 'admin' // Default to admin if profile not loaded
      const shouldIncludeDeleted = ['admin', 'manager'].includes(userRole)
      // Admin/Manager always see deleted projects, regular users never do

      console.log('🔍 ProjectContext loadProjects debug:', {
        userRole: userProfile?.role,
        userRoleUsed: userRole,
        includeDeletedParam: includeDeleted,
        shouldIncludeDeleted,
        userEmail: user.email,
        profileLoaded: !!userProfile
      })

      // Add timeout to prevent infinite loading (reduced to 3s for faster recovery)
      const loadPromise = ProjectService.getUserProjects(shouldIncludeDeleted)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Project loading timed out after 3 seconds')), 3000)
      )

      let userProjects: ProjectWithMembers[] = []

      try {
        userProjects = await Promise.race([loadPromise, timeoutPromise]) as ProjectWithMembers[]
      } catch (timeoutError) {
        console.warn('⚠️ Primary project query timed out, trying fallback...')

        // Fallback: Try simplified direct query without complex filters
        try {
          const { data: simpleProjects, error: fallbackError } = await supabase
            .from('projects')
            .select(`
              id,
              name,
              description,
              is_active,
              deleted_at,
              created_at,
              updated_at,
              created_by
            `)
            .eq('is_active', true)
            .is('deleted_at', null)
            .limit(20) // Further reduced limit
            .order('created_at', { ascending: false })

          if (fallbackError) throw fallbackError

          console.log('✅ Fallback query succeeded, got', simpleProjects?.length || 0, 'projects')
          userProjects = simpleProjects || []
        } catch (fallbackError) {
          console.error('❌ Even fallback query failed:', fallbackError)
          console.warn('⚠️ Continuing with empty projects array to allow app to function')
          userProjects = [] // Continue with empty array instead of throwing
        }
      }
      setProjects(userProjects)

      console.log('✅ Loaded projects:', userProjects.length)
      console.log('📋 Projects data:', userProjects.map(p => ({
        name: p.name,
        isActive: p.is_active,
        deletedAt: p.deleted_at,
        status: p.deleted_at ? 'DELETED' : 'ACTIVE'
      })))

      // Check if current project is still valid (exists and not permanently deleted)
      if (currentProject) {
        const currentProjectUpdated = userProjects.find(p => p.id === currentProject.id)
        if (!currentProjectUpdated || currentProjectUpdated.deleted_at) {
          // Only clear if project is deleted or doesn't exist
          // Allow user to stay with inactive projects for management purposes
          console.log('⚠️ Current project deleted or not found, clearing...', currentProject.name)
          setCurrentProject(null)
          localStorage.removeItem('selectedProjectId')
        } else if (!currentProjectUpdated.is_active && currentProject.is_active) {
          // Update currentProject state to reflect new inactive status
          console.log('📝 Current project became inactive, updating state...', currentProject.name)
          setCurrentProject(currentProjectUpdated)
        }
      }

      // Auto-select first ACTIVE project if none selected
      if (userProjects.length > 0 && !currentProject) {
        const savedProjectId = localStorage.getItem('selectedProjectId')
        let projectToSelect = null

        // Try to restore saved project if it's still active
        if (savedProjectId) {
          const savedProject = userProjects.find(p => p.id === savedProjectId)
          if (savedProject && !savedProject.deleted_at && savedProject.is_active) {
            projectToSelect = savedProject
          }
        }

        // If no valid saved project, find first active project
        if (!projectToSelect) {
          projectToSelect = userProjects.find(p => !p.deleted_at && p.is_active)
        }

        if (projectToSelect) {
          console.log('🎯 Auto-selecting project:', projectToSelect.name)
          setCurrentProject(projectToSelect)
          localStorage.setItem('selectedProjectId', projectToSelect.id)
        } else {
          console.log('⚠️ No active projects available for selection')
        }
      }

      // If no projects, show project selector
      if (userProjects.length === 0) {
        setShowProjectSelector(true)
      }

    } catch (error) {
      console.error('❌ Error loading projects:', error)
      if (error instanceof Error && error.message.includes('timed out')) {
        console.error('🕐 Project loading timeout - possible database connection issue')
        console.error('💡 Try refreshing the page or check database connectivity')
      }
      setProjects([])
      setCurrentProject(null)
      setShowProjectSelector(true) // Show selector to allow manual creation/retry
    } finally {
      setLoading(false)
      loadingProjectsRef.current = false
    }
  }

  // Create new project
  const createProject = async (projectData: CreateProjectData): Promise<Project | null> => {
    try {
      console.log('🔄 Creating project:', projectData.name)

      const newProject = await ProjectService.createProject(projectData)
      if (!newProject) {
        console.error('❌ Failed to create project')
        return null
      }

      console.log('✅ Created project:', newProject.name)

      // Reload projects to get updated list
      await loadProjects()

      // Auto-select the new project
      setCurrentProject(newProject)
      localStorage.setItem('selectedProjectId', newProject.id)
      setShowProjectSelector(false)

      return newProject
    } catch (error) {
      console.error('❌ Exception creating project:', error)
      return null
    }
  }

  // Update any project (can be current or different project)
  const updateProject = async (updates: Partial<Project>): Promise<boolean> => {
    // updates.id should contain the target project ID
    const targetProjectId = updates.id || currentProject?.id

    if (!targetProjectId) {
      console.error('❌ No project ID provided for update')
      return false
    }

    try {
      // Find the target project to update (may not be currentProject!)
      const targetProject = projects.find(p => p.id === targetProjectId)
      if (!targetProject) {
        console.error('❌ Target project not found:', targetProjectId)
        return false
      }

      console.log('🔄 Updating project:', targetProject.name, 'with data:', updates)

      const success = await ProjectService.updateProject({
        ...updates,
        id: targetProjectId  // Use the provided ID, not currentProject.id
      })

      if (success) {
        console.log('✅ Project update successful, updating context state...')

        // Only update currentProject state if we updated the current project
        if (targetProjectId === currentProject?.id) {
          setCurrentProject(prev => prev ? { ...prev, ...updates } : null)
          console.log('📝 Updated current project state')
        } else {
          console.log('📝 Updated different project, keeping current project unchanged')
        }

        // Reload projects to sync with database
        console.log('🔄 Reloading projects after update...')
        await loadProjects()

        console.log('✅ Updated project successfully')
      } else {
        console.error('❌ Project update failed')
      }

      return success
    } catch (error) {
      console.error('❌ Exception updating project:', error)
      return false
    }
  }

  // Delete project (soft delete by default, permanent if specified)
  const deleteProject = async (projectId: string, permanent: boolean = false): Promise<boolean> => {
    try {
      console.log(`🔥 ProjectContext.deleteProject STARTING:`)
      console.log(`   Type: ${permanent ? 'PERMANENT' : 'SOFT'} delete`)
      console.log(`   Target ID: ${projectId}`)
      console.log(`   Current project ID: ${currentProject?.id}`)

      console.log('🔄 Calling ProjectService.deleteProject...')
      const success = await ProjectService.deleteProject(projectId, permanent)

      console.log('🔍 ProjectService.deleteProject result:', success)

      if (!success) {
        console.error('❌ ProjectService.deleteProject returned FALSE')
        return false
      }

      console.log('✅ ProjectService.deleteProject returned TRUE')

      // If deleted project was current, clear it
      if (currentProject?.id === projectId) {
        console.log('🧹 Clearing current project (was the deleted project)')
        setCurrentProject(null)
        localStorage.removeItem('selectedProjectId')
      } else {
        console.log('💭 Deleted project was not current project, keeping current')
      }

      console.log('🔄 Reloading projects after delete...')
      await loadProjects()
      console.log('✅ Projects reloaded after delete')

      console.log(`🎉 ${permanent ? 'PERMANENT' : 'SOFT'} delete completed successfully`)
      return true
    } catch (error) {
      console.error('💥 EXCEPTION in ProjectContext.deleteProject:', error)
      return false
    }
  }

  // Restore soft-deleted project
  const restoreProject = async (projectId: string): Promise<boolean> => {
    try {
      console.log('🔄 Restoring project:', projectId)

      const success = await ProjectService.restoreProject(projectId)
      if (!success) {
        console.error('❌ Failed to restore project')
        return false
      }

      // Reload projects to show restored project
      await loadProjects()

      console.log('✅ Restored project successfully')
      return true
    } catch (error) {
      console.error('❌ Exception restoring project:', error)
      return false
    }
  }

  // Switch to different project (only allow active projects)
  const switchProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) {
      console.error('❌ Project not found:', projectId)
      return
    }

    // Check if project is available for selection
    const isDeleted = !!project.deleted_at
    const isInactive = !project.is_active && !isDeleted

    if (isDeleted) {
      console.warn('⚠️ Cannot switch to deleted project:', project.name)
      alert('Không thể chọn project đã bị xóa. Project này đang chờ xóa vĩnh viễn.')
      return
    }

    if (isInactive) {
      console.warn('⚠️ Cannot switch to inactive project:', project.name)
      alert('Không thể chọn project đang tạm dừng. Vui lòng kích hoạt project trước khi sử dụng.')
      return
    }

    console.log('🔄 Switching to project:', project.name)

    setCurrentProject(project)
    localStorage.setItem('selectedProjectId', project.id)
    setShowProjectSelector(false)

    console.log('✅ Switched to project:', project.name)
  }

  // Load projects when user changes
  useEffect(() => {
    const currentUserId = user?.id
    const prevUserId = prevUserIdRef.current

    if (currentUserId && currentUserId !== prevUserId) {
      console.log('👤 New user detected, loading projects...', user.email)
      loadProjects()
    } else if (!currentUserId && prevUserId) {
      // Clear all project state immediately on logout
      console.log('🔓 User logged out - clearing project state')
      setProjects([])
      setCurrentProject(null)
      setShowProjectSelector(false)
      setLoading(false)
      localStorage.removeItem('selectedProjectId')
    }

    prevUserIdRef.current = currentUserId
  }, [user?.id])

  // Reload projects when userProfile role changes (to include/exclude deleted projects)
  useEffect(() => {
    const currentUserRole = userProfile?.role
    const prevUserRole = prevUserRoleRef.current

    // Only reload if:
    // 1. User is logged in
    // 2. Profile has been loaded at least once (even if role is undefined)
    // 3. Role actually changed
    if (user?.id && userProfile !== null && currentUserRole !== prevUserRole) {
      console.log('🔄 User role changed, reloading projects...', prevUserRole, '=>', currentUserRole)
      loadProjects()
    }

    prevUserRoleRef.current = currentUserRole
  }, [userProfile?.role, user?.id, userProfile])

  // Auto-load saved project on mount
  useEffect(() => {
    if (projects.length > 0) {
      const savedProjectId = localStorage.getItem('selectedProjectId')
      if (savedProjectId && !currentProject) {
        const savedProject = projects.find(p => p.id === savedProjectId)
        if (savedProject) {
          console.log('🔄 Restoring saved project:', savedProject.name)
          setCurrentProject(savedProject)
        }
      }
    }
  }, [projects])

  // Load permissions when current project changes
  useEffect(() => {
    const loadCurrentProjectPermissions = async () => {
      if (!currentProject || !user?.id) {
        setCurrentProjectPermissions({
          can_manage_members: false,
          can_edit_project: false,
          can_delete_project: false,
          can_manage_woocommerce: false,
          can_edit_products: false,
          can_view_analytics: false
        })
        setUserRole('none')
        return
      }

      try {
        // TODO: Re-enable permission loading in Phase 3
        /*
        const [permissions, role] = await Promise.all([
          ProjectMembersService.getUserProjectPermissions(currentProject.project_id, user.id),
          ProjectMembersService.getUserProjectRole(currentProject.project_id, user.id)
        ])

        setCurrentProjectPermissions(permissions)
        setUserRole(role)

        console.log('🔐 Loaded permissions for project:', currentProject.name, {
          role,
          permissions
        })
        */

        // Temporary: Give admin full permissions
        if (userProfile?.role === 'admin') {
          setCurrentProjectPermissions({
            can_manage_members: true,
            can_edit_project: true,
            can_delete_project: true,
            can_manage_woocommerce: true,
            can_edit_products: true,
            can_view_analytics: true
          })
          setUserRole('admin')
        } else {
          setCurrentProjectPermissions({
            can_manage_members: false,
            can_edit_project: false,
            can_delete_project: false,
            can_manage_woocommerce: false,
            can_edit_products: false,
            can_view_analytics: false
          })
          setUserRole('none')
        }
      } catch (error) {
        console.error('❌ Error loading project permissions:', error)
        setCurrentProjectPermissions({
          can_manage_members: false,
          can_edit_project: false,
          can_delete_project: false,
          can_manage_woocommerce: false,
          can_edit_products: false,
          can_view_analytics: false
        })
        setUserRole('none')
      }
    }

    loadCurrentProjectPermissions()
  }, [currentProject, user?.id])

  // Helper functions
  const checkPermission = (permission: keyof UserPermissions): boolean => {
    return currentProjectPermissions[permission] || false
  }

  const canManageProject = (): boolean => {
    return checkPermission('can_edit_project') || checkPermission('can_delete_project')
  }

  const value = {
    currentProject,
    projects,
    loading,
    currentProjectPermissions,
    userRole,
    setCurrentProject,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    restoreProject,
    switchProject,
    checkPermission,
    canManageProject,
    showProjectSelector,
    setShowProjectSelector
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

export { ProjectProvider }
export default ProjectProvider