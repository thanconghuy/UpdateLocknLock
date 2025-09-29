// WooCommerce Connection Test Script
import { ProjectService } from '../services/projectService'

export const testWooCommerceConnectionWithProject = async (projectId?: string) => {
  console.log('🧪 Testing WooCommerce connection with project-specific config...')

  try {
    // Get all projects
    const projects = await ProjectService.getUserProjects()
    console.log('📋 Available projects:', projects.length)

    let targetProject = null

    if (projectId) {
      targetProject = projects.find(p => p.id === projectId)
      if (!targetProject) {
        console.error('❌ Project not found:', projectId)
        return
      }
    } else {
      // Use first active project
      targetProject = projects.find(p => p.is_active)
      if (!targetProject) {
        console.error('❌ No active projects found')
        return
      }
    }

    console.log('🎯 Testing project:', targetProject.name)
    console.log('🔧 WooCommerce URL:', targetProject.woocommerce_base_url)

    // Check if project has WooCommerce credentials
    if (!targetProject.woocommerce_consumer_key || !targetProject.woocommerce_consumer_secret) {
      console.error('❌ Project missing WooCommerce credentials')
      return
    }

    console.log('🔑 Consumer Key:', targetProject.woocommerce_consumer_key ?
      `${targetProject.woocommerce_consumer_key.substring(0, 10)}...` : 'Missing')
    console.log('🔐 Consumer Secret:', targetProject.woocommerce_consumer_secret ?
      `${targetProject.woocommerce_consumer_secret.substring(0, 10)}...` : 'Missing')

    // Test connection using ProjectService method
    const testResult = await ProjectService.testWooCommerceConnectionForProject(targetProject)

    if (testResult) {
      console.log('✅ WooCommerce connection test SUCCESSFUL!')
      console.log('🎉 Project-specific WooCommerce config is working correctly')
    } else {
      console.log('❌ WooCommerce connection test FAILED')
      console.log('💡 Check the following:')
      console.log('   - WooCommerce URL is correct and accessible')
      console.log('   - Consumer Key/Secret are valid')
      console.log('   - WooCommerce REST API is enabled')
      console.log('   - No firewall/CORS blocking the request')
    }

    return testResult

  } catch (error) {
    console.error('❌ Exception during WooCommerce test:', error)
    return false
  }
}

// Auto-run test on import (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 Auto-testing project-specific WooCommerce connection...')
  setTimeout(() => {
    testWooCommerceConnectionWithProject().then(result => {
      console.log('🧪 WooCommerce test result:', result ? 'SUCCESS' : 'FAILED')
    })
  }, 5000) // Wait 5 seconds after app load
}