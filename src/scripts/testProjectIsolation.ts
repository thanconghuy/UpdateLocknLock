// Test project isolation ngay lập tức
export const testProjectIsolation = () => {
  console.log('🧪 TESTING PROJECT ISOLATION')
  console.log('='.repeat(50))

  // Test với localStorage (fallback scenario)
  const projects = [
    { name: 'Locknlock Product AFF', products_table: 'products' },
    { name: 'Haychongiadung.net - AFF', products_table: 'products_haychongiadung' }
  ]

  console.log('\n📋 Project table mapping:')
  projects.forEach((proj, i) => {
    console.log(`${i + 1}. ${proj.name}`)
    console.log(`   Table: "${proj.products_table}"`)
  })

  // Check if they're using different tables
  const tables = projects.map(p => p.products_table)
  const uniqueTables = [...new Set(tables)]

  console.log('\n🔍 Analysis:')
  console.log('Unique tables:', uniqueTables.length)

  if (uniqueTables.length === 1) {
    console.log('⚠️ WARNING: All projects using same table!')
    console.log('   This means data will NOT be isolated')
    console.log('   Each project needs different products_table')
  } else {
    console.log('✅ Projects using different tables - good!')
  }

  // Test fallback config logic
  console.log('\n🧪 Testing fallback config logic:')
  projects.forEach(proj => {
    const mockCurrentProject = proj
    const tableName = mockCurrentProject?.products_table || 'products'
    console.log(`Project "${proj.name}" → Table: "${tableName}"`)
  })

  console.log('\n💡 Solutions if data not isolated:')
  console.log('1. Make sure projects have different products_table values')
  console.log('2. Check console logs show different table names when switching')
  console.log('3. Verify SettingsService timeout is resolved')

  console.log('\n📝 Expected console output when switching:')
  console.log('📋 Fallback using table: "products_haychongiadung" (project-specific)')
  console.log('🔄 ProductsPage: Current project changed...')
  console.log('🧹 Clearing Zustand store for project switch...')

  console.log('='.repeat(50))
}

// Auto-run immediately
if (typeof window !== 'undefined') {
  testProjectIsolation()
}