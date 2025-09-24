import { wooCommerceService } from '../services/woocommerce'
import { ENV, hasRequiredEnvVars } from '../config/env'

export interface ConnectionTestResult {
  success: boolean
  message: string
  details: {
    baseUrl: string
    hasCredentials: boolean
    apiVersion: string | null
    totalProducts: number | null
    sampleProducts: any[]
    responseTime: number
    errors: string[]
  }
}

export class WooCommerceConnectionTester {
  async testConnection(): Promise<ConnectionTestResult> {
    const result: ConnectionTestResult = {
      success: false,
      message: '',
      details: {
        baseUrl: ENV.WOOCOMMERCE_BASE_URL,
        hasCredentials: false,
        apiVersion: null,
        totalProducts: null,
        sampleProducts: [],
        responseTime: 0,
        errors: []
      }
    }

    try {
      console.log('🔍 Testing WooCommerce connection...')
      console.log('=' .repeat(60))

      // Step 1: Check environment variables
      console.log('📋 STEP 1: Checking environment variables...')
      const envCheck = this.checkEnvironmentVariables()
      result.details.hasCredentials = envCheck.hasCredentials

      if (!envCheck.hasCredentials) {
        result.details.errors = envCheck.errors
        result.message = 'Missing WooCommerce credentials'
        console.log('❌ Environment check failed:', envCheck.errors)
        return result
      }
      console.log('✅ Environment variables configured')

      // Step 2: Test API connectivity
      console.log('\n🌐 STEP 2: Testing API connectivity...')
      const startTime = Date.now()

      try {
        // Test with a simple request - get first page of products
        console.log(`   🔗 Connecting to: ${ENV.WOOCOMMERCE_BASE_URL}`)
        console.log(`   🔑 Using consumer key: ${ENV.WOOCOMMERCE_CONSUMER_KEY.substring(0, 8)}...`)

        const products = await wooCommerceService.getProducts({
          per_page: 5,
          page: 1,
          status: 'publish'
        })

        const endTime = Date.now()
        result.details.responseTime = endTime - startTime

        console.log(`   ⏱️ Response time: ${result.details.responseTime}ms`)

        if (products && products.length > 0) {
          result.details.sampleProducts = products.slice(0, 3) // Store first 3 for analysis
          result.details.totalProducts = products.length

          console.log(`   ✅ Successfully fetched ${products.length} products`)
          console.log(`   📦 Sample products:`)

          products.slice(0, 3).forEach((product, index) => {
            console.log(`      ${index + 1}. [ID: ${product.id}] ${product.name}`)
            console.log(`         💰 Price: ${product.regular_price || 'N/A'}`)
            console.log(`         📦 SKU: ${product.sku || 'N/A'}`)
          })

          // Step 3: Test individual product fetch
          console.log('\n🔍 STEP 3: Testing individual product fetch...')
          try {
            const firstProductId = products[0].id.toString()
            const singleProduct = await wooCommerceService.getProduct(firstProductId)

            if (singleProduct) {
              console.log(`   ✅ Successfully fetched product details for ID: ${firstProductId}`)
              console.log(`   📝 Product: ${singleProduct.title}`)
            } else {
              console.log(`   ⚠️ Could not fetch individual product details`)
              result.details.errors.push('Individual product fetch failed')
            }
          } catch (error) {
            console.log(`   ❌ Individual product fetch error:`, error)
            result.details.errors.push(`Individual product fetch: ${error instanceof Error ? error.message : 'Unknown error'}`)
          }

          // Step 4: Analyze API response format
          console.log('\n📊 STEP 4: Analyzing API response format...')
          this.analyzeProductFormat(products[0])

          result.success = true
          result.message = `Successfully connected to WooCommerce. Found ${products.length} products.`

        } else {
          console.log(`   ⚠️ API connected but no products found`)
          result.message = 'API connected but no products found'
          result.details.totalProducts = 0
        }

      } catch (apiError) {
        const endTime = Date.now()
        result.details.responseTime = endTime - startTime

        console.log(`   ❌ API connection failed:`, apiError)
        result.details.errors.push(`API Error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`)
        result.message = 'Failed to connect to WooCommerce API'

        // Try to provide more specific error information
        if (apiError instanceof Error) {
          if (apiError.message.includes('401')) {
            result.message = 'Authentication failed - check consumer key/secret'
          } else if (apiError.message.includes('404')) {
            result.message = 'API endpoint not found - check base URL'
          } else if (apiError.message.includes('ENOTFOUND') || apiError.message.includes('ECONNREFUSED')) {
            result.message = 'Cannot reach website - check URL and internet connection'
          }
        }
      }

      // Final summary
      console.log('\n' + '='.repeat(60))
      console.log('🎯 CONNECTION TEST SUMMARY')
      console.log('='.repeat(60))
      console.log(`Status: ${result.success ? '✅ SUCCESS' : '❌ FAILED'}`)
      console.log(`Message: ${result.message}`)
      console.log(`Base URL: ${result.details.baseUrl}`)
      console.log(`Has Credentials: ${result.details.hasCredentials}`)
      console.log(`Response Time: ${result.details.responseTime}ms`)
      console.log(`Products Found: ${result.details.totalProducts ?? 'N/A'}`)

      if (result.details.errors.length > 0) {
        console.log(`Errors: ${result.details.errors.length}`)
        result.details.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`)
        })
      }

      console.log('='.repeat(60))

      return result

    } catch (error) {
      console.error('❌ Connection test failed:', error)
      result.message = `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      result.details.errors.push(error instanceof Error ? error.message : 'Unknown error')
      return result
    }
  }

  private checkEnvironmentVariables() {
    const errors: string[] = []
    const hasRequiredVars = hasRequiredEnvVars()

    if (!ENV.WOOCOMMERCE_BASE_URL) {
      errors.push('VITE_WOOCOMMERCE_BASE_URL is missing')
    }
    if (!ENV.WOOCOMMERCE_CONSUMER_KEY) {
      errors.push('VITE_WOOCOMMERCE_CONSUMER_KEY is missing')
    }
    if (!ENV.WOOCOMMERCE_CONSUMER_SECRET) {
      errors.push('VITE_WOOCOMMERCE_CONSUMER_SECRET is missing')
    }

    return {
      hasCredentials: hasRequiredVars && errors.length === 0,
      errors
    }
  }

  private analyzeProductFormat(product: any) {
    console.log('   📊 Product data structure analysis:')
    console.log(`      🆔 ID: ${product.id} (${typeof product.id})`)
    console.log(`      📝 Name: ${product.name ? 'Present' : 'Missing'}`)
    console.log(`      💰 Regular Price: ${product.regular_price ? 'Present' : 'Missing'}`)
    console.log(`      🔥 Sale Price: ${product.sale_price ? 'Present' : 'Missing'}`)
    console.log(`      📦 SKU: ${product.sku ? 'Present' : 'Missing'}`)
    console.log(`      📂 Categories: ${product.categories ? `${product.categories.length} found` : 'Missing'}`)
    console.log(`      🖼️ Images: ${product.images ? `${product.images.length} found` : 'Missing'}`)
    console.log(`      📄 Description: ${product.description ? 'Present' : 'Missing'}`)
    console.log(`      🔗 Permalink: ${product.permalink ? 'Present' : 'Missing'}`)

    if (product.categories && product.categories.length > 0) {
      console.log(`      📂 Category names: ${product.categories.map((c: any) => c.name).join(', ')}`)
    }
  }

  // Quick test method for console
  async quickTest(): Promise<boolean> {
    try {
      const products = await wooCommerceService.getProducts({ per_page: 1 })
      return products && products.length > 0
    } catch {
      return false
    }
  }
}

// Export convenience functions
export async function testWooCommerceConnection(): Promise<ConnectionTestResult> {
  const tester = new WooCommerceConnectionTester()
  return await tester.testConnection()
}

export async function quickWooCommerceTest(): Promise<boolean> {
  const tester = new WooCommerceConnectionTester()
  return await tester.quickTest()
}