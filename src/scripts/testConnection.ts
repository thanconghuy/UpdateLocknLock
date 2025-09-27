// Quick connection test script
import { supabase } from '../lib/supabase'

export const testSupabaseConnection = async () => {
  console.log('🧪 Testing Supabase connection...')

  try {
    // Test 1: Simple query to test connectivity
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)

    if (error) {
      console.error('❌ Supabase query failed:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ Supabase connection successful')
    return { success: true, data }

  } catch (error: any) {
    console.error('❌ Supabase connection exception:', error)
    return { success: false, error: error.message }
  }
}

// Run test on import for debugging
if (process.env.NODE_ENV === 'development') {
  console.log('🚀 Auto-testing Supabase connection...')
  testSupabaseConnection().then(result => {
    console.log('🧪 Connection test result:', result)
  })
}