// Script to run product sync directly from console
// Usage: Open browser console and run the sync commands

import { syncMissingProducts, checkMissingProducts } from '../utils/productSyncChecker'
import { testWooCommerceConnection, quickWooCommerceTest } from '../utils/woocommerceConnectionTest'
import { debugWooCommerceSync, quickSyncHealthCheck } from '../utils/woocommerceSyncDebugger'

// Add functions to window object for console access
declare global {
  interface Window {
    productSync: {
      check: () => Promise<any>
      sync: () => Promise<any>
      testConnection: () => Promise<any>
      quickTest: () => Promise<boolean>
      debug: () => Promise<any>
      healthCheck: () => Promise<any>
      help: () => void
    }
  }
}

// Helper function to display help
function showHelp() {
  console.log(`
🔧 Product Sync Console Commands:

🛠️ Debug & Diagnostics:
  window.productSync.debug()
  - Full diagnostic with detailed issue analysis
  - Tests all sync components and data mapping
  - Provides troubleshooting recommendations

🏥 Quick Health Check:
  window.productSync.healthCheck()
  - Fast check of critical system components
  - Returns boolean health status

🔍 Test WooCommerce Connection:
  window.productSync.testConnection()
  - Full connection test with detailed analysis
  - Checks credentials, API endpoints, and data format
  - Shows sample products and response times

⚡ Quick Connection Test:
  window.productSync.quickTest()
  - Fast boolean check if WooCommerce is accessible
  - Returns true/false

📊 Check Missing Products:
  window.productSync.check()
  - Compares WooCommerce vs Tool database
  - Shows missing products list
  - No changes made

🚀 Sync Missing Products:
  window.productSync.sync()
  - Adds missing products to database
  - Shows detailed progress and results

❓ Show Help:
  window.productSync.help()

Example troubleshooting workflow:
  await window.productSync.debug()           // Full diagnostic first
  await window.productSync.testConnection()  // Test connection if issues
  await window.productSync.check()           // Check missing products
  await window.productSync.sync()            // Sync if all clear
`)
}

// Initialize console commands
if (typeof window !== 'undefined') {
  window.productSync = {
    check: async () => {
      try {
        console.log('🔍 Starting product check...')
        const result = await checkMissingProducts()

        console.log('\n📊 === CHECK RESULTS ===')
        console.log(`Tool Database: ${result.report.toolProducts} products`)
        console.log(`WooCommerce: ${result.report.wooProducts} products`)
        console.log(`Missing: ${result.report.missingProducts} products`)

        if (result.missing.length > 0) {
          console.log('\n📋 Missing Products:')
          result.missing.forEach((product, index) => {
            console.log(`${index + 1}. [${product.websiteId}] ${product.title}`)
            console.log(`   Price: ${product.price.toLocaleString('vi-VN')}₫`)
            console.log(`   SKU: ${product.sku || 'N/A'}`)
            console.log(`   Category: ${product.category || 'N/A'}`)
            console.log('---')
          })

          console.log(`\n💡 To sync these ${result.missing.length} products, run:`)
          console.log('   await window.productSync.sync()')
        } else {
          console.log('\n✅ All products are already synced!')
        }

        return result
      } catch (error) {
        console.error('❌ Check failed:', error)
        throw error
      }
    },

    sync: async () => {
      try {
        console.clear()
        console.log('🚀 PRODUCT SYNC CONSOLE MODE')
        console.log('='.repeat(80))
        console.log('⏰ Started at:', new Date().toLocaleString('vi-VN'))
        console.log('🔧 This will sync missing products from WooCommerce to Tool database')
        console.log('='.repeat(80))

        const report = await syncMissingProducts()

        console.log('\n' + '🎯'.repeat(20) + ' FINAL RESULTS ' + '🎯'.repeat(20))
        console.log('Tool Products (before sync):', report.toolProducts)
        console.log('WooCommerce Products (total):', report.wooProducts)
        console.log('Missing Products Detected:', report.missingProducts)
        console.log('Successfully Added to Tool:', report.newlyAdded)
        console.log('Errors Encountered:', report.errors.length)
        console.log('Tool Products (after sync):', report.toolProducts + report.newlyAdded)

        if (report.errors.length > 0) {
          console.log('\n❌ ERRORS DETAILS:')
          console.log('='.repeat(50))
          report.errors.forEach((error, index) => {
            console.error(`${index + 1}. ${error}`)
          })
        }

        if (report.newlyAdded > 0) {
          console.log(`\n🎉 SYNC SUCCESS!`)
          console.log(`✅ Added ${report.newlyAdded} new products to tool database`)
          console.log(`📈 Your tool now manages ${report.toolProducts + report.newlyAdded} products total`)
          console.log(`\n💡 Next steps:`)
          console.log(`   • Refresh your tool interface to see new products`)
          console.log(`   • Check Products page to verify data`)
          console.log(`   • Review platform links for accuracy`)
        } else if (report.missingProducts === 0) {
          console.log(`\n✅ ALL PRODUCTS ALREADY SYNCED!`)
          console.log(`🎯 Your tool database is perfectly up to date`)
          console.log(`📊 Both WooCommerce and Tool have ${report.wooProducts} products`)
        } else {
          console.log(`\n⚠️ PARTIAL SYNC COMPLETED`)
          console.log(`📝 Found ${report.missingProducts} missing products but couldn't add them`)
          console.log(`🔍 Check error details above for troubleshooting`)
        }

        console.log('\n' + '='.repeat(80))
        console.log('⏰ Completed at:', new Date().toLocaleString('vi-VN'))
        console.log('='.repeat(80))

        return report
      } catch (error) {
        console.error('\n❌ SYNC PROCESS FAILED:')
        console.error('='.repeat(50))
        console.error('Error:', error)
        console.error('\n💡 Troubleshooting tips:')
        console.error('   • Check internet connection')
        console.error('   • Verify WooCommerce API credentials')
        console.error('   • Check Supabase database connection')
        console.error('   • Try running window.productSync.check() first')
        throw error
      }
    },

    testConnection: async () => {
      try {
        console.clear()
        console.log('🔍 WOOCOMMERCE CONNECTION TEST')
        console.log('='.repeat(80))

        const result = await testWooCommerceConnection()

        if (result.success) {
          console.log('\n✅ CONNECTION SUCCESS!')
          console.log(`🌐 Connected to: ${result.details.baseUrl}`)
          console.log(`📦 Found ${result.details.totalProducts} products`)
          console.log(`⏱️ Response time: ${result.details.responseTime}ms`)

          if (result.details.sampleProducts.length > 0) {
            console.log('\n📋 Sample products:')
            result.details.sampleProducts.slice(0, 3).forEach((product: any, index: number) => {
              console.log(`   ${index + 1}. [${product.id}] ${product.name}`)
              console.log(`      💰 ${product.regular_price || 'No price'} | 📦 SKU: ${product.sku || 'No SKU'}`)
            })
          }

          console.log('\n💡 Next steps:')
          console.log('   • Run window.productSync.check() to see missing products')
          console.log('   • Run window.productSync.sync() to sync missing products')
        } else {
          console.log('\n❌ CONNECTION FAILED!')
          console.log(`🚫 ${result.message}`)

          if (result.details.errors.length > 0) {
            console.log('\n📋 Errors:')
            result.details.errors.forEach((error, index) => {
              console.log(`   ${index + 1}. ${error}`)
            })
          }

          console.log('\n💡 Troubleshooting:')
          console.log('   • Check if VITE_WOOCOMMERCE_BASE_URL is correct')
          console.log('   • Verify VITE_WOOCOMMERCE_CONSUMER_KEY and SECRET')
          console.log('   • Make sure WooCommerce REST API is enabled')
          console.log('   • Check if website is accessible')
        }

        return result
      } catch (error) {
        console.error('❌ Connection test failed:', error)
        throw error
      }
    },

    quickTest: async () => {
      try {
        console.log('⚡ Quick connection test...')
        const isConnected = await quickWooCommerceTest()
        console.log(isConnected ? '✅ WooCommerce is accessible' : '❌ WooCommerce is not accessible')
        return isConnected
      } catch (error) {
        console.error('❌ Quick test failed:', error)
        return false
      }
    },

    debug: async () => {
      try {
        console.clear()
        console.log('🛠️ WOOCOMMERCE SYNC DEBUGGER')
        console.log('='.repeat(80))
        console.log('🔧 Running comprehensive diagnostic...')

        const result = await debugWooCommerceSync()

        console.log('\n' + '🎯'.repeat(15) + ' DIAGNOSTIC COMPLETE ' + '🎯'.repeat(15))

        if (result.success) {
          console.log('✅ OVERALL STATUS: HEALTHY')
          console.log('🎉 All systems operational - sync functionality ready!')
        } else {
          console.log('❌ OVERALL STATUS: ISSUES DETECTED')
          console.log('🔧 Issues need to be resolved before sync operations')
        }

        console.log(`\n📊 SUMMARY:`)
        console.log(`   Total Issues: ${result.issues.length}`)
        console.log(`   Errors: ${result.issues.filter(i => i.severity === 'error').length}`)
        console.log(`   Warnings: ${result.issues.filter(i => i.severity === 'warning').length}`)

        if (result.recommendations.length > 0) {
          console.log('\n💡 TOP RECOMMENDATIONS:')
          result.recommendations.slice(0, 3).forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`)
          })
        }

        if (result.success) {
          console.log('\n🚀 NEXT STEPS:')
          console.log('   • Run window.productSync.check() to see missing products')
          console.log('   • Run window.productSync.sync() to perform sync')
        } else {
          console.log('\n🔧 NEXT STEPS:')
          console.log('   • Review detailed issues above')
          console.log('   • Fix critical errors first')
          console.log('   • Run debug again to verify fixes')
        }

        return result
      } catch (error) {
        console.error('❌ Debug failed:', error)
        throw error
      }
    },

    healthCheck: async () => {
      try {
        console.log('🏥 Running quick health check...')
        const result = await quickSyncHealthCheck()

        if (result.healthy) {
          console.log('✅ SYSTEM HEALTHY - All critical components operational')
        } else {
          console.log('❌ SYSTEM UNHEALTHY - Critical issues detected:')
          result.criticalIssues.forEach((issue, index) => {
            console.log(`   ${index + 1}. ${issue}`)
          })
          console.log('\n💡 Run window.productSync.debug() for detailed analysis')
        }

        return result
      } catch (error) {
        console.error('❌ Health check failed:', error)
        return { healthy: false, criticalIssues: ['Health check failed'] }
      }
    },

    help: showHelp
  }

  // Show help on first load
  console.log('🔧 Product Sync Tools loaded!')
  console.log('Type window.productSync.help() for usage instructions')
}

export { syncMissingProducts, checkMissingProducts }