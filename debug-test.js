// Debug test script - Copy and paste this into browser console

console.log('🔧 STARTING DEBUG TEST...')

// Test 1: Check if debug tools are loaded
if (typeof window.productSync !== 'undefined') {
  console.log('✅ ProductSync tools are loaded')
  console.log('Available commands:', Object.keys(window.productSync))
} else {
  console.log('❌ ProductSync tools not loaded')
}

// Test 2: Run help command
try {
  window.productSync.help()
  console.log('✅ Help command works')
} catch (error) {
  console.log('❌ Help command failed:', error)
}

// Test 3: Run health check
async function testHealthCheck() {
  try {
    console.log('🏥 Running health check...')
    const result = await window.productSync.healthCheck()
    console.log('✅ Health check completed:', result)
  } catch (error) {
    console.log('❌ Health check failed:', error)
  }
}

// Test 4: Run quick test
async function testQuickTest() {
  try {
    console.log('⚡ Running quick test...')
    const result = await window.productSync.quickTest()
    console.log('✅ Quick test completed:', result)
  } catch (error) {
    console.log('❌ Quick test failed:', error)
  }
}

// Test 5: Run debug (comment out if you don't want full debug)
async function testFullDebug() {
  try {
    console.log('🛠️ Running full debug...')
    const result = await window.productSync.debug()
    console.log('✅ Full debug completed')
    return result
  } catch (error) {
    console.log('❌ Full debug failed:', error)
  }
}

// Run tests
async function runAllTests() {
  console.log('\n🧪 RUNNING ALL DEBUG TESTS...')
  console.log('='.repeat(50))

  await testHealthCheck()
  await testQuickTest()

  // Uncomment to run full debug
  // await testFullDebug()

  console.log('\n✅ DEBUG TESTS COMPLETED')
  console.log('='.repeat(50))
}

// Auto-run tests
runAllTests()

// Export test functions for manual use
window.debugTests = {
  healthCheck: testHealthCheck,
  quickTest: testQuickTest,
  fullDebug: testFullDebug,
  runAll: runAllTests
}