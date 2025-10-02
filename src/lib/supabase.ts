// ==========================================================================
// CENTRALIZED SUPABASE CLIENT - SINGLETON PATTERN
// ==========================================================================
// Single source of truth for Supabase client to prevent multiple instances

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ENV } from '../config/env'

// Singleton instance
let supabaseInstance: SupabaseClient | null = null
let supabaseAdminInstance: SupabaseClient | null = null

export const getSupabaseClient = (): SupabaseClient => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      global: {
        headers: {
          'x-client-info': 'wp-product-manager'
        }
      }
    })

    console.log('✅ Centralized Supabase client initialized')
  }

  return supabaseInstance
}

/**
 * Get Supabase Admin Client with Service Role Key
 * ⚠️ WARNING: Only use this for admin operations (creating users, etc.)
 * DO NOT expose Service Role Key to client
 */
export const getSupabaseAdminClient = (): SupabaseClient => {
  if (!supabaseAdminInstance) {
    if (!ENV.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not configured!')
      console.error('⚠️ Admin operations like creating users will fail')
      console.error('💡 Please add VITE_SUPABASE_SERVICE_ROLE_KEY to your .env file')
      // Return regular client as fallback (will fail for admin operations)
      return getSupabaseClient()
    }

    supabaseAdminInstance = createClient(
      ENV.SUPABASE_URL,
      ENV.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            'x-client-info': 'wp-product-manager-admin'
          }
        }
      }
    )

    console.log('✅ Supabase Admin client initialized (Service Role)')
  }

  return supabaseAdminInstance
}

// Export the singleton instance
export const supabase = getSupabaseClient()

// Export admin client for admin operations
export const supabaseAdmin = getSupabaseAdminClient()

// Export default for easier imports
export default supabase