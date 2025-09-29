// Manual test for WooCommerce project-specific functionality
import { ProjectService } from '../services/projectService'
import { WooCommerceService } from '../services/woocommerce'

export const runWooCommerceManualTest = async () => {
  console.log('🧪 Starting manual WooCommerce project-specific test...')

  try {
    // Test 1: Get all projects
    console.log('\n📋 Step 1: Fetching all projects...')
    const projects = await ProjectService.getUserProjects()
    console.log(`Found ${projects.length} projects:`)

    projects.forEach((project, index) => {
      console.log(`${index + 1}. ${project.name}`)
      console.log(`   - ID: ${project.id}`)
      console.log(`   - Active: ${project.is_active}`)
      console.log(`   - WooCommerce URL: ${project.woocommerce_base_url || 'Not set'}`)
      console.log(`   - Has Consumer Key: ${project.woocommerce_consumer_key ? 'Yes' : 'No'}`)
      console.log(`   - Has Consumer Secret: ${project.woocommerce_consumer_secret ? 'Yes' : 'No'}`)
      console.log('---')
    })

    // Test 2: Test project-specific WooCommerce service
    console.log('\n🔧 Step 2: Testing project-specific WooCommerce service...')

    if (projects.length === 0) {
      console.log('❌ No projects found - cannot test WooCommerce functionality')
      return false
    }

    // Find first project with WooCommerce config
    const projectWithWoo = projects.find(p =>
      p.woocommerce_base_url &&
      p.woocommerce_consumer_key &&
      p.woocommerce_consumer_secret
    )

    if (!projectWithWoo) {
      console.log('❌ No projects with WooCommerce configuration found')
      console.log('💡 Create a project with WooCommerce settings to test connectivity')
      return false
    }

    console.log(`🎯 Testing project: ${projectWithWoo.name}`)
    console.log(`🔧 WooCommerce URL: ${projectWithWoo.woocommerce_base_url}`)

    // Test 3: Create WooCommerce service instance with project
    console.log('\n⚙️ Step 3: Creating project-specific WooCommerce service...')
    const wooService = new WooCommerceService(projectWithWoo)

    // Test 4: Try to fetch products
    console.log('\n📦 Step 4: Testing product fetch with project credentials...')
    try {
      const products = await wooService.getProducts({ per_page: 1 })
      console.log(`✅ Successfully fetched ${products.length} products using project-specific config`)

      if (products.length > 0) {
        console.log(`📝 Sample product: ${products[0].name} (ID: ${products[0].id})`)
      }

      return true
    } catch (error) {
      console.log('❌ Failed to fetch products with project credentials:', error)
      return false
    }

  } catch (error) {
    console.error('❌ Manual test failed:', error)
    return false
  }
}

// Auto-run in development if imported
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.log('🚀 Auto-running WooCommerce manual test...')
  setTimeout(() => {
    runWooCommerceManualTest().then(success => {
      console.log(`🧪 Manual WooCommerce test ${success ? 'PASSED' : 'FAILED'}`)
    })
  }, 3000) // Wait 3 seconds for app to load
}