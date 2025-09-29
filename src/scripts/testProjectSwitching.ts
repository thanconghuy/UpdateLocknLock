// Test script cho project switching functionality
export const testProjectSwitchingFeatures = () => {
  console.log('🧪 Testing Project Switching Features...')
  console.log('='.repeat(60))

  // Test 1: Check ProjectContext
  console.log('\n📋 Test 1: ProjectContext functionality')
  const context = (window as any).ProjectContext
  if (context) {
    console.log('✅ ProjectContext available globally')
    console.log('📍 Current project:', context.currentProject?.name || 'None')
    console.log('📋 Available projects:', context.projects?.length || 0)
  } else {
    console.log('❌ ProjectContext not available globally')
  }

  // Test 2: Check project-specific table usage
  console.log('\n📊 Test 2: Project-specific table configuration')
  const currentProject = (window as any).ProjectContext?.currentProject
  if (currentProject) {
    console.log('✅ Current project loaded')
    console.log('📋 Products table:', currentProject.products_table || 'Default')
    console.log('📈 Audit table:', currentProject.audit_table || 'Default')
    console.log('🔧 WooCommerce URL:', currentProject.woocommerce_base_url || 'Not set')
  } else {
    console.log('❌ No current project available')
  }

  // Test 3: Check localStorage project persistence
  console.log('\n💾 Test 3: Project persistence')
  const savedProjectId = localStorage.getItem('selectedProjectId')
  if (savedProjectId) {
    console.log('✅ Project ID saved in localStorage:', savedProjectId)
  } else {
    console.log('❌ No project ID in localStorage')
  }

  // Test 4: Console instructions for manual testing
  console.log('\n🔧 Manual Testing Instructions:')
  console.log('1. Open browser DevTools Console')
  console.log('2. Test project switching:')
  console.log('   - Click project selector in header')
  console.log('   - Switch to different project')
  console.log('   - Watch console logs for:')
  console.log('     * "ProjectsPage: Current project changed"')
  console.log('     * "Dashboard loading stats for project"')
  console.log('     * Table names being used')
  console.log('3. Verify data changes:')
  console.log('   - Dashboard stats should update')
  console.log('   - Products page should reload different data')
  console.log('   - WooCommerce connections use project credentials')

  console.log('\n🎯 Expected Behavior:')
  console.log('• Dashboard shows stats for current project only')
  console.log('• Products page loads data from project-specific table')
  console.log('• WooCommerce operations use project credentials')
  console.log('• Project switching clears data and reloads')

  console.log('\n📝 Console Commands for Testing:')
  console.log('// Switch project programmatically:')
  console.log('// window.ProjectContext.switchProject("project-id-here")')
  console.log('// ')
  console.log('// Check current project table:')
  console.log('// console.log(window.ProjectContext.currentProject?.products_table)')
  console.log('// ')
  console.log('// View all projects:')
  console.log('// console.log(window.ProjectContext.projects)')

  console.log('\n' + '='.repeat(60))
  console.log('🧪 Project Switching Test Script Complete')
}

// Make ProjectContext available globally for testing
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  import('../contexts/ProjectContext').then(({ useProject }) => {
    // This is for testing purposes only
    console.log('🔧 ProjectContext debugging available via React DevTools')
  })

  // Auto-run test
  setTimeout(() => {
    testProjectSwitchingFeatures()
  }, 2000)
}