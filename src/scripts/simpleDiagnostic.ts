// Simple diagnostic script
import { ProjectService } from '../services/projectService'
import { supabase } from '../lib/supabase'

interface DiagnosticResult {
  timestamp: string
  auth: {
    isAuthenticated: boolean
    userId: string | null
    userEmail: string | null
  }
  database: {
    projectsTable: boolean
    productUpdatesTable: boolean
    systemSettingsTable: boolean
  }
  services: {
    projectService: boolean
    createProject: boolean
    getUserProjects: boolean
  }
  summary: string[]
}

async function runDiagnostic(): Promise<DiagnosticResult> {
  const result: DiagnosticResult = {
    timestamp: new Date().toISOString(),
    auth: {
      isAuthenticated: false,
      userId: null,
      userEmail: null
    },
    database: {
      projectsTable: false,
      productUpdatesTable: false,
      systemSettingsTable: false
    },
    services: {
      projectService: false,
      createProject: false,
      getUserProjects: false
    },
    summary: []
  }

  // Test authentication
  try {
    const { data: { user } } = await supabase.auth.getUser()
    result.auth.isAuthenticated = !!user
    result.auth.userId = user?.id || null
    result.auth.userEmail = user?.email || null
    result.summary.push(`✅ Auth: ${user?.email || 'Not authenticated'}`)
  } catch (error) {
    result.summary.push('❌ Auth: Failed to get user')
  }

  // Test database tables
  try {
    const { data, error } = await supabase.from('projects').select('count', { count: 'exact', head: true })
    result.database.projectsTable = !error
    result.summary.push(result.database.projectsTable ? '✅ Projects table: OK' : '❌ Projects table: Missing')
  } catch (error) {
    result.summary.push('❌ Projects table: Error')
  }

  try {
    const { data, error } = await supabase.from('product_updates').select('count', { count: 'exact', head: true })
    result.database.productUpdatesTable = !error
    result.summary.push(result.database.productUpdatesTable ? '✅ Product_updates table: OK' : '❌ Product_updates table: Missing')
  } catch (error) {
    result.summary.push('❌ Product_updates table: Error')
  }

  try {
    const { data, error } = await supabase.from('system_settings').select('count', { count: 'exact', head: true })
    result.database.systemSettingsTable = !error
    result.summary.push(result.database.systemSettingsTable ? '✅ System_settings table: OK' : '❌ System_settings table: Missing')
  } catch (error) {
    result.summary.push('❌ System_settings table: Error')
  }

  // Test ProjectService
  try {
    result.services.projectService = typeof ProjectService !== 'undefined'
    result.services.getUserProjects = typeof ProjectService.getUserProjects === 'function'
    result.services.createProject = typeof ProjectService.createProject === 'function'
    result.summary.push('✅ ProjectService: Available')
  } catch (error) {
    result.summary.push('❌ ProjectService: Not available')
  }

  // Test getUserProjects
  try {
    const projects = await ProjectService.getUserProjects()
    result.summary.push(`✅ getUserProjects: ${projects.length} projects found`)
  } catch (error: any) {
    result.summary.push(`❌ getUserProjects: ${error?.message || 'Error'}`)
  }

  return result
}

// Test create project
async function testCreateProject(): Promise<any> {
  try {
    console.log('🧪 Testing project creation...')

    const testProject = await ProjectService.createProject({
      name: `Test Project ${Date.now()}`,
      description: 'Auto-generated test project',
      woocommerce_base_url: 'https://test-store.example.com',
      woocommerce_consumer_key: 'test_key_12345',
      woocommerce_consumer_secret: 'test_secret_12345',
      products_table: 'products',
      audit_table: 'product_updates'
    })

    if (testProject) {
      console.log('✅ Project created successfully:', testProject)
      return testProject
    } else {
      console.log('❌ Project creation failed: returned null')
      return null
    }
  } catch (error) {
    console.error('❌ Project creation error:', error)
    return { error: error }
  }
}

// Refresh user profile to get updated role
async function refreshUserProfile(): Promise<any> {
  try {
    console.log('🔄 Refreshing user profile...')

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('❌ No user found')
      return { error: 'No user found' }
    }

    // Fetch fresh profile from database
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('❌ Error fetching profile:', error)
      return { error: error.message }
    }

    console.log('✅ Fresh profile from database:', profile)

    // Trigger a page refresh to reload AuthContext
    console.log('🔄 Refreshing page to reload AuthContext...')
    window.location.reload()

    return profile
  } catch (error: any) {
    console.error('❌ Exception refreshing profile:', error)
    return { error: error.message }
  }
}

// Export to window for console access
declare global {
  interface Window {
    simpleDiagnostic: {
      run: () => Promise<DiagnosticResult>
      testCreateProject: () => Promise<any>
      refreshUserProfile: () => Promise<any>
      ProjectService: typeof ProjectService
    }
    projectDebug: {
      runCompleteDiagnostic: () => Promise<DiagnosticResult>
      testCreateProject: () => Promise<any>
      refreshUserProfile: () => Promise<any>
      ProjectService: typeof ProjectService
    }
  }
}

window.simpleDiagnostic = {
  run: runDiagnostic,
  testCreateProject,
  refreshUserProfile,
  ProjectService
}

// Create projectDebug alias for backward compatibility
window.projectDebug = {
  runCompleteDiagnostic: runDiagnostic,
  testCreateProject,
  refreshUserProfile,
  ProjectService
}

console.log('🔧 Simple diagnostic loaded! Use:')
console.log('  await window.simpleDiagnostic.run() - Run full diagnostic')
console.log('  await window.projectDebug.runCompleteDiagnostic() - Run complete diagnostic (alias)')
console.log('  await window.simpleDiagnostic.testCreateProject() - Test create project')