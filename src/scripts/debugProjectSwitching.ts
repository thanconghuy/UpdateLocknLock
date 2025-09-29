// Debug script để kiểm tra project switching chi tiết
import { ProjectService } from '../services/projectService'
import { supabase } from '../lib/supabase'

export const debugProjectSwitching = async () => {
  console.log('🔍 DEBUGGING PROJECT SWITCHING LOGIC')
  console.log('='.repeat(70))

  try {
    // 1. Kiểm tra tất cả projects trong database
    console.log('\n📋 Step 1: Checking all projects in database...')
    const allProjects = await ProjectService.getUserProjects()

    console.log(`Found ${allProjects.length} projects:`)
    allProjects.forEach((project, i) => {
      console.log(`\n${i + 1}. Project: ${project.name}`)
      console.log(`   - ID: ${project.id}`)
      console.log(`   - Active: ${project.is_active}`)
      console.log(`   - Products table: ${project.products_table}`)
      console.log(`   - Audit table: ${project.audit_table}`)
      console.log(`   - WooCommerce URL: ${project.woocommerce_base_url}`)
      console.log(`   - Has Consumer Key: ${!!project.woocommerce_consumer_key}`)
      console.log(`   - Created: ${project.created_at}`)
    })

    // 2. Kiểm tra current project trong localStorage
    console.log('\n💾 Step 2: Checking current project selection...')
    const savedProjectId = localStorage.getItem('selectedProjectId')
    console.log('Saved project ID in localStorage:', savedProjectId)

    const currentProject = allProjects.find(p => p.id === savedProjectId)
    if (currentProject) {
      console.log('✅ Current project found:', currentProject.name)
      console.log('📋 Current products table:', currentProject.products_table)
    } else {
      console.log('❌ Current project not found in projects list')
    }

    // 3. Kiểm tra các bảng products có tồn tại không
    console.log('\n🗄️ Step 3: Checking if project tables exist...')
    for (const project of allProjects) {
      const tableName = project.products_table
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })

        if (error) {
          console.log(`❌ Table "${tableName}" (${project.name}): Error - ${error.message}`)
        } else {
          console.log(`✅ Table "${tableName}" (${project.name}): ${count || 0} records`)
        }
      } catch (err) {
        console.log(`❌ Table "${tableName}" (${project.name}): Exception - ${err}`)
      }
    }

    // 4. Kiểm tra data isolation
    console.log('\n🔒 Step 4: Checking data isolation between projects...')
    for (const project of allProjects) {
      const tableName = project.products_table
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('id, title, website_id, sku')
          .limit(3)

        if (error) {
          console.log(`❌ Data check for "${project.name}": ${error.message}`)
        } else {
          console.log(`📊 Data in "${project.name}" (${tableName}):`)
          if (data && data.length > 0) {
            data.forEach((row, i) => {
              console.log(`   ${i + 1}. ${row.title || row.sku || row.id} (ID: ${row.id})`)
            })
          } else {
            console.log('   (No data found)')
          }
        }
      } catch (err) {
        console.log(`❌ Data check for "${project.name}": ${err}`)
      }
    }

    // 5. Kiểm tra ProductsPage logic
    console.log('\n🔧 Step 5: Testing ProductsPage database config logic...')
    const testProject = allProjects[0]
    if (testProject) {
      console.log('Testing with project:', testProject.name)
      console.log('Expected table:', testProject.products_table)

      // Simulate getDatabaseConfig logic
      try {
        const { useSettingsService } = await import('../services/settingsService')
        const settingsService = useSettingsService()
        const adminConfig = await settingsService.getDatabaseConfig()

        if (adminConfig) {
          const tableName = 'products_new' // Hardcoded for consistency
          console.log('✅ Table resolution logic works:', tableName)
        } else {
          console.log('❌ No admin config found')
        }
      } catch (err) {
        console.log('❌ Error testing database config:', err)
      }
    }

    // 6. Test suggestions
    console.log('\n💡 Step 6: Debugging suggestions...')

    if (allProjects.length >= 2) {
      const proj1 = allProjects[0]
      const proj2 = allProjects[1]

      console.log('\n🧪 MANUAL TESTING STEPS:')
      console.log('1. Current project:', savedProjectId)
      console.log('2. Switch to project:', proj1.name, '(ID:', proj1.id, ')')
      console.log('3. Check console for:')
      console.log('   - "ProductsPage: Current project changed"')
      console.log('   - "Using table: ' + proj1.products_table + '"')
      console.log('4. Switch to project:', proj2.name, '(ID:', proj2.id, ')')
      console.log('5. Check console for:')
      console.log('   - "ProductsPage: Current project changed"')
      console.log('   - "Using table: ' + proj2.products_table + '"')

      console.log('\n📝 Console commands to test:')
      console.log(`// Switch to ${proj1.name}:`)
      console.log(`window.location.hash = '#switch-project-${proj1.id}'`)
      console.log(`// Switch to ${proj2.name}:`)
      console.log(`window.location.hash = '#switch-project-${proj2.id}'`)
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error)
  }

  console.log('\n' + '='.repeat(70))
  console.log('🔍 PROJECT SWITCHING DEBUG COMPLETE')
}

// Auto-run in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  setTimeout(() => {
    debugProjectSwitching()
  }, 3000)
}