// ==========================================================================
// CENTRALIZED SUPABASE CLIENT - SINGLETON PATTERN
// ==========================================================================
// Single source of truth for Supabase client to prevent multiple instances

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { ENV } from '../config/env'

// Singleton instance
let supabaseInstance: SupabaseClient | null = null

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

// Export the singleton instance
export const supabase = getSupabaseClient()

// Export default for easier imports
export default supabase