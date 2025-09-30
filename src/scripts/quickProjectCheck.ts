// Quick check để xem projects configuration
import { ProjectService } from '../services/projectService'

export const quickProjectCheck = async () => {
  console.log('⚡ QUICK PROJECT CHECK')
  console.log('='.repeat(50))

  try {
    // Check authentication first
    const { supabase } = await import('../lib/supabase')
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.log('ℹ️ No authenticated user - skipping project check')
      console.log('='.repeat(50))
      return
    }

    console.log('👤 User authenticated:', user.email)
    const projects = await ProjectService.getUserProjects()

    console.log('📋 Projects found:', projects.length)

    projects.forEach((project, i) => {
      console.log(`\n${i + 1}. ${project.name}`)
      console.log(`   Products table: "${project.products_table}"`)
      console.log(`   WooCommerce: ${project.woocommerce_base_url}`)
    })

    // Check if they're using the same table
    const productsTables = projects.map(p => p.products_table)
    const uniqueTables = [...new Set(productsTables)]

    console.log('\n🔍 Analysis:')
    console.log('Tables in use:', uniqueTables)

    if (uniqueTables.length === 1) {
      console.log('⚠️ WARNING: All projects using the same table!')
      console.log('This is why data is not isolated between projects.')
      console.log('Each project should have its own products_table.')
    } else {
      console.log('✅ Projects using different tables - this is correct')
    }

    // Show current project
    const savedId = localStorage.getItem('selectedProjectId')
    const current = projects.find(p => p.id === savedId)
    console.log('\n📍 Current project:', current?.name || 'None')
    console.log('📋 Current table:', current?.products_table || 'None')

  } catch (error) {
    console.error('❌ Quick check failed:', error)
  }

  console.log('='.repeat(50))
}

// Auto-run
if (typeof window !== 'undefined') {
  setTimeout(quickProjectCheck, 1000)
}