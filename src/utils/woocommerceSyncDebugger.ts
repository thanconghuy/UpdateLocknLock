import { wooCommerceService } from '../services/woocommerce'
import { supabase } from '../lib/supabase'
import { ENV, hasRequiredEnvVars } from '../config/env'
import { detectPlatformLinks } from './links'
import { parsePriceText } from './priceUtils'

export interface DebugResult {
  success: boolean
  issues: DebugIssue[]
  recommendations: string[]
  testResults: {
    environment: boolean
    woocommerceConnection: boolean
    supabaseConnection: boolean
    dataMapping: boolean
    platformLinkDetection: boolean
    priceFormatting: boolean
  }
}

export interface DebugIssue {
  severity: 'error' | 'warning' | 'info'
  category: string
  message: string
  details?: any
  solution?: string
}

export class WooCommerceSyncDebugger {
  private issues: DebugIssue[] = []
  private supabase = hasRequiredEnvVars() ? supabase : null

  async runFullDiagnostic(): Promise<DebugResult> {
    console.log('🔧 WOOCOMMERCE SYNC DEBUGGER')
    console.log('='.repeat(80))
    console.log('⏰ Started at:', new Date().toLocaleString('vi-VN'))
    console.log('🔍 Running comprehensive diagnostic...')
    console.log('='.repeat(80))

    this.issues = []

    const testResults = {
      environment: await this.testEnvironment(),
      woocommerceConnection: await this.testWooCommerceConnection(),
      supabaseConnection: await this.testSupabaseConnection(),
      dataMapping: await this.testDataMapping(),
      platformLinkDetection: await this.testPlatformLinkDetection(),
      priceFormatting: await this.testPriceFormatting()
    }

    const recommendations = this.generateRecommendations()
    const success = this.issues.filter(i => i.severity === 'error').length === 0

    console.log('\n' + '🎯'.repeat(20) + ' DIAGNOSTIC SUMMARY ' + '🎯'.repeat(20))
    console.log(`Overall Status: ${success ? '✅ HEALTHY' : '❌ ISSUES FOUND'}`)
    console.log(`Total Issues: ${this.issues.length}`)
    console.log(`Errors: ${this.issues.filter(i => i.severity === 'error').length}`)
    console.log(`Warnings: ${this.issues.filter(i => i.severity === 'warning').length}`)
    console.log(`Info: ${this.issues.filter(i => i.severity === 'info').length}`)

    if (this.issues.length > 0) {
      console.log('\n📋 ISSUES FOUND:')
      console.log('='.repeat(60))
      this.issues.forEach((issue, index) => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'
        console.log(`${index + 1}. ${icon} [${issue.category}] ${issue.message}`)
        if (issue.details) {
          console.log(`   Details: ${JSON.stringify(issue.details, null, 2)}`)
        }
        if (issue.solution) {
          console.log(`   💡 Solution: ${issue.solution}`)
        }
        console.log('')
      })
    }

    if (recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:')
      console.log('='.repeat(60))
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`)
      })
    }

    console.log('\n' + '='.repeat(80))

    return {
      success,
      issues: this.issues,
      recommendations,
      testResults
    }
  }

  private async testEnvironment(): Promise<boolean> {
    console.log('\n🌍 TESTING ENVIRONMENT CONFIGURATION...')
    let passed = true

    // Check required environment variables
    const requiredVars = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
      'VITE_WOOCOMMERCE_BASE_URL',
      'VITE_WOOCOMMERCE_CONSUMER_KEY',
      'VITE_WOOCOMMERCE_CONSUMER_SECRET'
    ]

    requiredVars.forEach(varName => {
      const value = (ENV as any)[varName.replace('VITE_', '').replace('WOOCOMMERCE_BASE_URL', 'WOOCOMMERCE_BASE_URL')]

      if (!value) {
        this.addIssue('error', 'Environment', `Missing ${varName}`, undefined,
          `Set ${varName} in your .env file`)
        passed = false
      } else {
        console.log(`   ✅ ${varName}: ${varName.includes('KEY') || varName.includes('SECRET') ? 'Configured' : value}`)
      }
    })

    // Check environment setup
    if (!hasRequiredEnvVars()) {
      this.addIssue('error', 'Environment', 'Required environment variables not configured')
      passed = false
    } else {
      console.log('   ✅ All required environment variables configured')
    }

    return passed
  }

  private async testWooCommerceConnection(): Promise<boolean> {
    console.log('\n🛒 TESTING WOOCOMMERCE CONNECTION...')

    try {
      const startTime = Date.now()
      const products = await wooCommerceService.getProducts({ per_page: 1, page: 1 })
      const endTime = Date.now()
      const responseTime = endTime - startTime

      if (products && products.length > 0) {
        console.log(`   ✅ WooCommerce API accessible`)
        console.log(`   ⏱️ Response time: ${responseTime}ms`)

        if (responseTime > 5000) {
          this.addIssue('warning', 'Performance',
            `Slow WooCommerce API response: ${responseTime}ms`,
            { responseTime },
            'Check internet connection or WooCommerce server performance')
        }

        // Test individual product fetch
        try {
          const productId = products[0].id.toString()
          const singleProduct = await wooCommerceService.getProduct(productId)

          if (singleProduct) {
            console.log(`   ✅ Individual product fetch working`)
          } else {
            this.addIssue('warning', 'API', 'Individual product fetch returned null')
          }
        } catch (error) {
          this.addIssue('warning', 'API', 'Individual product fetch failed', error)
        }

        return true
      } else {
        this.addIssue('warning', 'Data', 'WooCommerce API accessible but no products found')
        return true // Connection works, just no data
      }

    } catch (error: any) {
      console.log(`   ❌ WooCommerce connection failed`)

      if (error.message?.includes('401')) {
        this.addIssue('error', 'Authentication', 'WooCommerce authentication failed', error,
          'Check WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET')
      } else if (error.message?.includes('404')) {
        this.addIssue('error', 'Configuration', 'WooCommerce API endpoint not found', error,
          'Check WOOCOMMERCE_BASE_URL and ensure WooCommerce REST API is enabled')
      } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED')) {
        this.addIssue('error', 'Network', 'Cannot reach WooCommerce website', error,
          'Check internet connection and website URL')
      } else {
        this.addIssue('error', 'API', 'WooCommerce API error', error,
          'Check WooCommerce configuration and server status')
      }

      return false
    }
  }

  private async testSupabaseConnection(): Promise<boolean> {
    console.log('\n💾 TESTING SUPABASE CONNECTION...')

    if (!this.supabase) {
      this.addIssue('error', 'Database', 'Supabase client not initialized')
      return false
    }

    try {
      // Test basic connection
      const { data, error } = await this.supabase
        .from(ENV.DEFAULT_PRODUCTS_TABLE)
        .select('id')
        .limit(1)

      if (error) {
        this.addIssue('error', 'Database', 'Supabase connection failed', error,
          'Check SUPABASE_URL and SUPABASE_ANON_KEY')
        return false
      }

      console.log('   ✅ Supabase connection working')

      // Test table structure
      const { data: tableInfo, error: tableError } = await this.supabase
        .from(ENV.DEFAULT_PRODUCTS_TABLE)
        .select('*')
        .limit(0)

      if (tableError) {
        this.addIssue('warning', 'Database', `Products table issue: ${tableError.message}`, tableError)
      } else {
        console.log('   ✅ Products table accessible')
      }

      return true

    } catch (error) {
      this.addIssue('error', 'Database', 'Supabase connection error', error)
      return false
    }
  }

  private async testDataMapping(): Promise<boolean> {
    console.log('\n🔄 TESTING DATA MAPPING...')

    try {
      // Create mock WooCommerce product data
      const mockWooProduct = {
        id: 12345,
        name: 'Test Product Hộp Lock&Lock',
        regular_price: '299000',
        sale_price: '249000',
        sku: 'LL-TEST-001',
        categories: [{ name: 'Hộp nhựa' }, { name: 'Kitchen' }],
        images: [{ src: 'https://example.com/image.jpg' }],
        permalink: 'https://locknlockvietnam.com/test-product',
        description: 'Sản phẩm test với link Shopee: https://shopee.vn/test-123'
      }

      console.log('   📝 Testing data transformation...')

      // Test price parsing
      const price = parsePriceText(mockWooProduct.regular_price)
      const salePrice = parsePriceText(mockWooProduct.sale_price)

      if (price !== 299000) {
        this.addIssue('warning', 'Data Mapping',
          `Price parsing issue: expected 299000, got ${price}`)
      } else {
        console.log('   ✅ Price parsing working')
      }

      // Test category joining
      const category = mockWooProduct.categories.map(c => c.name).join(', ')
      if (category !== 'Hộp nhựa, Kitchen') {
        this.addIssue('warning', 'Data Mapping',
          `Category joining issue: got "${category}"`)
      } else {
        console.log('   ✅ Category mapping working')
      }

      // Test platform link detection
      const platformLinks = detectPlatformLinks(mockWooProduct.description)
      if (!platformLinks.shopee) {
        this.addIssue('warning', 'Data Mapping',
          'Platform link detection not working for Shopee')
      } else {
        console.log('   ✅ Platform link detection working')
      }

      return true

    } catch (error) {
      this.addIssue('error', 'Data Mapping', 'Data mapping test failed', error)
      return false
    }
  }

  private async testPlatformLinkDetection(): Promise<boolean> {
    console.log('\n🔗 TESTING PLATFORM LINK DETECTION...')

    const testCases = [
      {
        description: 'Mua tại Shopee: https://shopee.vn/product-123',
        expected: { shopee: 'https://shopee.vn/product-123' }
      },
      {
        description: 'TikTok: https://vt.tiktok.com/shop-456 và Lazada: https://lazada.vn/item-789',
        expected: {
          tiktok: 'https://vt.tiktok.com/shop-456',
          lazada: 'https://lazada.vn/item-789'
        }
      },
      {
        description: 'Không có link nào',
        expected: {}
      }
    ]

    let allPassed = true

    testCases.forEach((testCase, index) => {
      try {
        const result = detectPlatformLinks(testCase.description)

        Object.keys(testCase.expected).forEach(platform => {
          const expectedUrl = (testCase.expected as any)[platform]
          const actualUrl = (result as any)[platform]

          if (actualUrl !== expectedUrl) {
            this.addIssue('warning', 'Platform Detection',
              `Test case ${index + 1} failed for ${platform}: expected "${expectedUrl}", got "${actualUrl}"`)
            allPassed = false
          }
        })

        if (allPassed) {
          console.log(`   ✅ Test case ${index + 1}: ${Object.keys(testCase.expected).join(', ') || 'No links'}`)
        }

      } catch (error) {
        this.addIssue('error', 'Platform Detection', `Test case ${index + 1} threw error`, error)
        allPassed = false
      }
    })

    return allPassed
  }

  private async testPriceFormatting(): Promise<boolean> {
    console.log('\n💰 TESTING PRICE FORMATTING...')

    const testCases = [
      { input: '299000', expected: 299000 },
      { input: '299,000', expected: 299000 },
      { input: '299.000', expected: 299000 },
      { input: '299.000₫', expected: 299000 },
      { input: '1,299,000 VND', expected: 1299000 },
      { input: '', expected: 0 },
      { input: 'invalid', expected: 0 }
    ]

    let allPassed = true

    testCases.forEach((testCase, index) => {
      try {
        const result = parsePriceText(testCase.input)

        if (result !== testCase.expected) {
          this.addIssue('warning', 'Price Formatting',
            `Price parsing failed for "${testCase.input}": expected ${testCase.expected}, got ${result}`)
          allPassed = false
        } else {
          console.log(`   ✅ "${testCase.input}" → ${result}`)
        }

      } catch (error) {
        this.addIssue('error', 'Price Formatting',
          `Price parsing threw error for "${testCase.input}"`, error)
        allPassed = false
      }
    })

    return allPassed
  }

  private addIssue(severity: 'error' | 'warning' | 'info', category: string, message: string, details?: any, solution?: string) {
    this.issues.push({
      severity,
      category,
      message,
      details,
      solution
    })
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = []

    const errorCount = this.issues.filter(i => i.severity === 'error').length
    const warningCount = this.issues.filter(i => i.severity === 'warning').length

    if (errorCount > 0) {
      recommendations.push('🔴 Fix critical errors before attempting sync operations')
    }

    if (warningCount > 0) {
      recommendations.push('🟡 Address warnings to improve sync reliability')
    }

    const hasNetworkIssues = this.issues.some(i => i.category === 'Network')
    if (hasNetworkIssues) {
      recommendations.push('🌐 Check internet connection and firewall settings')
    }

    const hasAuthIssues = this.issues.some(i => i.category === 'Authentication')
    if (hasAuthIssues) {
      recommendations.push('🔑 Verify WooCommerce API credentials in WooCommerce admin panel')
    }

    const hasPerformanceIssues = this.issues.some(i => i.category === 'Performance')
    if (hasPerformanceIssues) {
      recommendations.push('⚡ Consider optimizing WooCommerce server or reducing batch sizes')
    }

    if (this.issues.length === 0) {
      recommendations.push('✅ All systems operational - sync functionality should work correctly')
    }

    return recommendations
  }

  // Quick health check
  async quickHealthCheck(): Promise<{ healthy: boolean, criticalIssues: string[] }> {
    const criticalIssues: string[] = []

    if (!hasRequiredEnvVars()) {
      criticalIssues.push('Environment variables not configured')
    }

    try {
      await wooCommerceService.getProducts({ per_page: 1 })
    } catch {
      criticalIssues.push('WooCommerce API not accessible')
    }

    if (this.supabase) {
      try {
        await this.supabase.from(ENV.DEFAULT_PRODUCTS_TABLE).select('id').limit(1)
      } catch {
        criticalIssues.push('Supabase database not accessible')
      }
    } else {
      criticalIssues.push('Supabase not configured')
    }

    return {
      healthy: criticalIssues.length === 0,
      criticalIssues
    }
  }
}

// Export convenience functions
export async function debugWooCommerceSync(): Promise<DebugResult> {
  const debugInstance = new WooCommerceSyncDebugger()
  return await debugInstance.runFullDiagnostic()
}

export async function quickSyncHealthCheck(): Promise<{ healthy: boolean, criticalIssues: string[] }> {
  const debugInstance = new WooCommerceSyncDebugger()
  return await debugInstance.quickHealthCheck()
}