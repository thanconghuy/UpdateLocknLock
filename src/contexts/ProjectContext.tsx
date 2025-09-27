import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Project, ProjectWithMembers, CreateProjectData } from '../types/project'
import { ProjectService } from '../services/projectService'
import { useAuth } from './AuthContext'

interface ProjectContextType {
  // Current project state
  currentProject: Project | null
  projects: ProjectWithMembers[]
  loading: boolean

  // Actions
  setCurrentProject: (project: Project | null) => void
  loadProjects: () => Promise<void>
  createProject: (projectData: CreateProjectData) => Promise<Project | null>
  updateCurrentProject: (updates: Partial<Project>) => Promise<boolean>
  deleteProject: (projectId: string) => Promise<boolean>
  switchProject: (projectId: string) => Promise<void>

  // Project selection state
  showProjectSelector: boolean
  setShowProjectSelector: (show: boolean) => void
}

const ProjectContext = createContext<ProjectContextType>({
  currentProject: null,
  projects: [],
  loading: true,
  setCurrentProject: () => {},
  loadProjects: async () => {},
  createProject: async () => null,
  updateCurrentProject: async () => false,
  deleteProject: async () => false,
  switchProject: async () => {},
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

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [projects, setProjects] = useState<ProjectWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [showProjectSelector, setShowProjectSelector] = useState(false)

  const { user, userProfile } = useAuth()

  // Load all projects for current user
  const loadProjects = async () => {
    if (!user?.id) {
      setProjects([])
      setCurrentProject(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('🔄 Loading projects for user:', user.email)

      // Add timeout to prevent infinite loading
      const loadPromise = ProjectService.getUserProjects()
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Project loading timed out after 15 seconds')), 15000)
      )

      const userProjects = await Promise.race([loadPromise, timeoutPromise]) as ProjectWithMembers[]
      setProjects(userProjects)

      console.log('✅ Loaded projects:', userProjects.length)

      // Auto-select first project if none selected
      if (userProjects.length > 0 && !currentProject) {
        const savedProjectId = localStorage.getItem('selectedProjectId')
        const projectToSelect = savedProjectId
          ? userProjects.find(p => p.id === savedProjectId) || userProjects[0]
          : userProjects[0]

        console.log('🎯 Auto-selecting project:', projectToSelect.name)
        setCurrentProject(projectToSelect)
        localStorage.setItem('selectedProjectId', projectToSelect.id)
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

  // Update current project
  const updateCurrentProject = async (updates: Partial<Project>): Promise<boolean> => {
    if (!currentProject) {
      console.error('❌ No current project to update')
      return false
    }

    try {
      console.log('🔄 Updating project:', currentProject.name)

      const success = await ProjectService.updateProject({
        ...updates,
        id: currentProject.id
      })

      if (success) {
        // Update current project state
        setCurrentProject(prev => prev ? { ...prev, ...updates } : null)

        // Reload projects to sync with database
        await loadProjects()

        console.log('✅ Updated project successfully')
      }

      return success
    } catch (error) {
      console.error('❌ Exception updating project:', error)
      return false
    }
  }

  // Delete project
  const deleteProject = async (projectId: string): Promise<boolean> => {
    try {
      console.log('🔄 Deleting project:', projectId)

      const success = await ProjectService.deleteProject(projectId)
      if (!success) {
        console.error('❌ Failed to delete project')
        return false
      }

      // If deleted project was current, clear it
      if (currentProject?.id === projectId) {
        setCurrentProject(null)
        localStorage.removeItem('selectedProjectId')
      }

      // Reload projects
      await loadProjects()

      console.log('✅ Deleted project successfully')
      return true
    } catch (error) {
      console.error('❌ Exception deleting project:', error)
      return false
    }
  }

  // Switch to different project
  const switchProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) {
      console.error('❌ Project not found:', projectId)
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
    if (user?.id) {
      loadProjects()
    } else {
      // Clear all project state immediately on logout
      console.log('🔓 User logged out - clearing project state')
      setProjects([])
      setCurrentProject(null)
      setShowProjectSelector(false)
      setLoading(false)
      localStorage.removeItem('selectedProjectId')
    }
  }, [user?.id])

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

  const value = {
    currentProject,
    projects,
    loading,
    setCurrentProject,
    loadProjects,
    createProject,
    updateCurrentProject,
    deleteProject,
    switchProject,
    showProjectSelector,
    setShowProjectSelector
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

export default ProjectContext