// Debug script for loading issues
import { supabase } from '../lib/supabase'

export const debugLoadingIssues = async () => {
  console.log('🔍 DEBUG: Starting loading issue investigation...')

  try {
    // 1. Check Auth Status
    console.log('1. Checking authentication...')
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError) {
      console.error('❌ Auth Error:', authError.message)
      return { step: 'auth', error: authError.message }
    }

    if (!user) {
      console.log('⚠️ No authenticated user')
      return { step: 'auth', error: 'No user logged in' }
    }

    console.log('✅ User authenticated:', user.email)

    // 2. Check User Profile
    console.log('2. Checking user profile...')
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('❌ Profile Error:', profileError.message)
      return { step: 'profile', error: profileError.message }
    }

    console.log('✅ User profile loaded:', profile)

    // 3. Check Projects Table
    console.log('3. Checking projects table...')
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .limit(5)

    if (projectsError) {
      console.error('❌ Projects Error:', projectsError.message)
      return { step: 'projects', error: projectsError.message }
    }

    console.log('✅ Projects table accessible, found:', projects?.length || 0, 'projects')

    // 4. Check Connection Speed
    console.log('4. Testing connection speed...')
    const startTime = Date.now()

    const { error: pingError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)

    const duration = Date.now() - startTime

    if (pingError) {
      console.error('❌ Ping Error:', pingError.message)
      return { step: 'ping', error: pingError.message }
    }

    console.log(`✅ Database ping: ${duration}ms`)

    if (duration > 5000) {
      console.warn('⚠️ Slow database connection detected')
      return { step: 'performance', warning: `Slow connection: ${duration}ms` }
    }

    console.log('🎉 All checks passed!')
    return {
      step: 'complete',
      user: user.email,
      profile: profile.role,
      projectCount: projects?.length || 0,
      pingTime: duration
    }

  } catch (error) {
    console.error('❌ Debug exception:', error)
    return { step: 'exception', error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Auto-run on import in development (disabled to prevent startup errors)
// To manually run debug, call: debugLoadingIssues()
if (process.env.NODE_ENV === 'development' && false) {
  setTimeout(() => {
    console.log('🚀 Auto-running loading debug check...')
    debugLoadingIssues().then(result => {
      console.log('🔍 Debug result:', result)
    })
  }, 5000) // Wait 5 seconds after app load
}