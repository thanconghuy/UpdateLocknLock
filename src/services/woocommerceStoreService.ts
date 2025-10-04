import { supabase } from '../lib/supabase'
import { WooCommerceStore } from '../types/project'

export class WooCommerceStoreService {
  /**
   * Get all accessible WooCommerce stores for current user
   */
  static async getAccessibleStores(): Promise<WooCommerceStore[]> {
    try {
      const { data, error } = await supabase
        .from('woocommerce_stores')
        .select('*')
        .eq('is_active', true)
        .order('store_name', { ascending: true })

      if (error) {
        console.error('❌ Error fetching WooCommerce stores:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('❌ Exception fetching WooCommerce stores:', error)
      return []
    }
  }

  /**
   * Create a new WooCommerce store or return existing one
   */
  static async createOrGetStore(storeData: {
    base_url: string
    store_name?: string
    consumer_key: string
    consumer_secret: string
  }): Promise<WooCommerceStore | null> {
    try {
      // First, check if store already exists
      const { data: existing, error: existingError } = await supabase
        .from('woocommerce_stores')
        .select('*')
        .eq('base_url', storeData.base_url)
        .single()

      if (existingError && existingError.code !== 'PGRST116') {
        // Error other than "not found"
        console.error('❌ Error checking existing store:', existingError)
        return null
      }

      if (existing) {
        // Store exists, check if credentials match
        if (existing.consumer_key === storeData.consumer_key &&
            existing.consumer_secret === storeData.consumer_secret) {
          console.log('✅ Using existing WooCommerce store:', existing.store_name || existing.base_url)
          return existing
        } else {
          console.warn('⚠️ Store exists but credentials differ. Creating new store record.')
          // Could implement credential update logic here
        }
      }

      // Create new store
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) {
        console.error('❌ User not authenticated')
        return null
      }

      const newStore = {
        base_url: storeData.base_url,
        store_name: storeData.store_name || this.extractStoreName(storeData.base_url),
        consumer_key: storeData.consumer_key,
        consumer_secret: storeData.consumer_secret,
        created_by: user.user.id,
        is_active: true
      }

      const { data, error } = await supabase
        .from('woocommerce_stores')
        .insert([newStore])
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating WooCommerce store:', error)
        return null
      }

      console.log('✅ Created new WooCommerce store:', data.store_name || data.base_url)
      return data
    } catch (error) {
      console.error('❌ Exception in createOrGetStore:', error)
      return null
    }
  }

  /**
   * Test WooCommerce store connection
   */
  static async testStoreConnection(storeId: number): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const { data: store, error } = await supabase
        .from('woocommerce_stores')
        .select('*')
        .eq('id', storeId)
        .single()

      if (error || !store) {
        return { success: false, error: 'Store not found' }
      }

      // Test WooCommerce API connection
      const testUrl = `${store.base_url}/wp-json/wc/v3/system_status`
      const auth = btoa(`${store.consumer_key}:${store.consumer_secret}`)

      const response = await fetch(testUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      })

      const success = response.ok

      // Update store test status
      await supabase
        .from('woocommerce_stores')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: success ? 'success' : 'failed',
          last_error_message: success ? null : `HTTP ${response.status}: ${response.statusText}`
        })
        .eq('id', storeId)

      return {
        success,
        error: success ? undefined : `Connection failed: ${response.statusText}`
      }
    } catch (error) {
      console.error('❌ Error testing store connection:', error)

      // Update store with error
      await supabase
        .from('woocommerce_stores')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: 'failed',
          last_error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', storeId)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get store by ID
   */
  static async getStoreById(storeId: number): Promise<WooCommerceStore | null> {
    try {
      const { data, error } = await supabase
        .from('woocommerce_stores')
        .select('*')
        .eq('id', storeId)
        .single()

      if (error) {
        console.error('❌ Error fetching store by ID:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('❌ Exception fetching store by ID:', error)
      return null
    }
  }

  /**
   * Extract friendly store name from URL
   */
  private static extractStoreName(url: string): string {
    try {
      const cleanUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
      return cleanUrl.split('.')[0] || cleanUrl
    } catch {
      return url
    }
  }

  /**
   * Update store information
   */
  static async updateStore(storeId: number, updates: Partial<WooCommerceStore>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('woocommerce_stores')
        .update(updates)
        .eq('id', storeId)

      if (error) {
        console.error('❌ Error updating store:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('❌ Exception updating store:', error)
      return false
    }
  }

  /**
   * Get projects using a specific store
   */
  static async getProjectsUsingStore(storeId: number): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, is_active')
        .eq('woocommerce_store_id', storeId)
        .order('name')

      if (error) {
        console.error('❌ Error fetching projects using store:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('❌ Exception fetching projects using store:', error)
      return []
    }
  }
}