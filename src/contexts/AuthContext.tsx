import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthError, User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UserProfile {
  id: string
  email: string
  full_name?: string
  role?: string
  primary_role_id?: string
  is_active: boolean
  created_at: string
  roles?: {
    id: string
    name: string
    display_name?: string
    level?: number
  }
}

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  session: Session | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error: AuthError | null }>
  register: (email: string, password: string, metadata?: any) => Promise<{ error: AuthError | null }>
  logout: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  refreshProfile: () => Promise<void>
  hasPermission: (permission: string) => boolean
  isAdmin: () => boolean
  isEditor: () => boolean
  isViewer: () => boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  session: null,
  loading: true,
  login: async () => ({ error: null }),
  register: async () => ({ error: null }),
  logout: async () => {},
  resetPassword: async () => ({ error: null }),
  refreshProfile: async () => {},
  hasPermission: () => false,
  isAdmin: () => false,
  isEditor: () => false,
  isViewer: () => false
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Prevent infinite reload detection
  const [initCount, setInitCount] = useState(0)

  // Fetch user profile using bypass function to avoid RLS issues
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      console.log('🔐 AuthContext: Fetching profile for:', userId)

      // Try using the bypass function first
      const { data: profileData, error: bypassError } = await supabase
        .rpc('get_user_with_role', { user_id: userId })

      if (!bypassError && profileData) {
        console.log('✅ Profile loaded via bypass function:', profileData)
        return profileData
      }

      console.warn('⚠️ Bypass function failed, trying direct query:', bypassError)

      // Fallback to direct query
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, role, primary_role_id, is_active, created_at')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Profile fetch error:', error)
        console.error('❌ Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })

        // If profile doesn't exist, try to create one
        if (error.code === 'PGRST116') {
          console.log('🔐 Creating basic profile...')

          const { data: authUser } = await supabase.auth.getUser()
          if (!authUser.user) return null

          // Get admin role ID first
          const { data: adminRole } = await supabase
            .from('roles')
            .select('id')
            .eq('name', 'admin')
            .single()

          const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert({
              id: userId,
              email: authUser.user.email || '',
              full_name: authUser.user.email || '',
              role: 'admin',
              primary_role_id: adminRole?.id || null,
              is_active: true
            })
            .select('id, email, full_name, role, primary_role_id, is_active, created_at')
            .single()

          if (createError) {
            console.error('❌ Create profile error:', createError)
            return null
          }

          console.log('✅ Profile created:', newProfile)
          return newProfile
        }

        return null
      }

      console.log('✅ Profile loaded via direct query:', profile)

      // Now fetch role info separately if primary_role_id exists
      if (profile.primary_role_id) {
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('id, name, display_name, level')
          .eq('id', profile.primary_role_id)
          .single()

        if (!roleError && roleData) {
          console.log('✅ Role info loaded:', roleData)
          ;(profile as any).roles = roleData
        } else {
          console.warn('⚠️ Could not load role info:', roleError)
        }
      }

      return profile

    } catch (error) {
      console.error('❌ Profile fetch exception:', error)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      console.log('🔄 RefreshProfile: Starting for user:', user.id)
      const profile = await fetchUserProfile(user.id)
      console.log('🔄 RefreshProfile: Got profile:', profile)
      setUserProfile(profile)
      console.log('🔄 RefreshProfile: Profile set in state')
    } else {
      console.log('🔄 RefreshProfile: No user to refresh')
    }
  }

  // Ensure user profile exists for new users
  const ensureUserProfile = async (authUser: any) => {
    try {
      console.log('🔄 Ensuring user profile exists for:', authUser.id)

      // Check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', authUser.id)
        .single()

      if (checkError && checkError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        console.log('🔨 Creating profile for new user:', authUser.email)

        // Get default role (viewer) ID
        const { data: defaultRole } = await supabase
          .from('roles')
          .select('id')
          .eq('name', 'viewer')
          .single()

        const newProfile = {
          id: authUser.id,
          email: authUser.email || '',
          full_name: authUser.user_metadata?.full_name || authUser.email || '',
          role: 'viewer', // Default role for new users
          primary_role_id: defaultRole?.id || null,
          is_active: false // New users start as inactive, awaiting admin approval
        }

        const { error: createError } = await supabase
          .from('user_profiles')
          .insert(newProfile)

        if (createError) {
          console.error('❌ Error creating user profile:', createError)
        } else {
          console.log('✅ User profile created successfully for:', authUser.email)
        }
      } else if (!checkError) {
        console.log('✅ User profile already exists')
      } else {
        console.error('❌ Error checking user profile:', checkError)
      }

    } catch (error) {
      console.error('❌ Exception in ensureUserProfile:', error)
    }
  }

  // Initialize auth
  useEffect(() => {
    let mounted = true
    let initTimeout: NodeJS.Timeout

    const initializeAuth = async () => {
      try {
        setInitCount(prev => {
          const newCount = prev + 1
          console.log('🔐 AuthContext: Initializing... (attempt', newCount, ')')

          // Prevent infinite loops - max 3 attempts
          if (newCount > 3) {
            console.error('❌ Too many initialization attempts, stopping to prevent loop')
            setLoading(false)
            return newCount
          }
          return newCount
        })

        // Add timeout protection (2 seconds max)
        const initPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Auth init timeout')), 2000)
        )

        let currentSession: any = null

        try {
          const result = await Promise.race([initPromise, timeoutPromise])
          currentSession = result.data.session
        } catch (timeoutError) {
          console.warn('⚠️ AuthContext: Init timeout - likely cache conflict')
          console.warn('💡 Suggestion: Clear browser cache or use incognito mode')
          // Continue with null session to allow normal flow
          currentSession = null
        }

        if (mounted) {
          setSession(currentSession)
          setUser(currentSession?.user ?? null)

          if (currentSession?.user) {
            console.log('🔄 Init: Fetching profile for:', currentSession.user.id)

            // Add profile fetch timeout (2 seconds max)
            const profilePromise = fetchUserProfile(currentSession.user.id)
            const profileTimeoutPromise = new Promise<UserProfile | null>((_, reject) =>
              setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
            )

            try {
              const profile = await Promise.race([profilePromise, profileTimeoutPromise])
              console.log('🔄 Init: Got profile:', profile)
              if (mounted) {
                setUserProfile(profile)
                console.log('🔄 Init: Profile set in state')
              }
            } catch (profileError) {
              console.warn('⚠️ Profile fetch timeout, continuing without profile')
              if (mounted) {
                setUserProfile(null)
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        // On timeout, proceed without authentication
        if (mounted) {
          setSession(null)
          setUser(null)
          setUserProfile(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
          console.log('✅ AuthContext: Initialization complete')
        }
      }
    }

    // Delay initialization slightly to prevent rapid reload loops
    initTimeout = setTimeout(initializeAuth, 100)

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('🔐 AuthContext: Auth state changed:', event)

        if (mounted) {
          setSession(currentSession)
          setUser(currentSession?.user ?? null)

          if (currentSession?.user) {
            console.log('🔄 Auth state change: Fetching profile for:', currentSession.user.id)

            // Special handling for SIGNED_IN event (new registration or login)
            if (event === 'SIGNED_IN') {
              await ensureUserProfile(currentSession.user)
            }

            const profile = await fetchUserProfile(currentSession.user.id)
            console.log('🔄 Auth state change: Got profile:', profile)
            if (mounted) {
              setUserProfile(profile)
              console.log('🔄 Auth state change: Profile set in state')
            }
          } else {
            console.log('🔄 Auth state change: No user, clearing profile')
            setUserProfile(null)
          }
        }
      }
    )

    return () => {
      mounted = false
      if (initTimeout) clearTimeout(initTimeout)
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    console.log('🔐 AuthContext: Logging in...')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const register = async (email: string, password: string, metadata?: any) => {
    console.log('🔐 AuthContext: Registering...')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    })
    return { error }
  }

  const logout = async () => {
    try {
      console.log('🔐 AuthContext: Starting logout process...')

      // Clear profile immediately
      setUserProfile(null)
      setUser(null)
      setSession(null)

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('❌ Logout error:', error)
        // Even if signOut fails, we've cleared local state
      } else {
        console.log('✅ Logout successful')
      }

      // Force page reload to ensure clean state
      window.location.href = '/'

    } catch (error) {
      console.error('❌ Exception during logout:', error)
      // Force logout anyway
      setUserProfile(null)
      setUser(null)
      setSession(null)
      window.location.href = '/'
    }
  }

  const resetPassword = async (email: string) => {
    console.log('🔐 AuthContext: Resetting password...')
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error }
  }

  const hasPermission = (permission: string): boolean => {
    // Simple permission check based on role
    const role = userProfile?.role

    if (role === 'admin') return true
    if (role === 'manager' && ['read', 'write'].includes(permission)) return true
    if (role === 'viewer' && permission === 'read') return true

    return false
  }

  const isAdmin = (): boolean => {
    return userProfile?.role === 'admin'
  }

  const isEditor = (): boolean => {
    return userProfile?.role === 'editor' || userProfile?.role === 'admin'
  }

  const isViewer = (): boolean => {
    return userProfile?.role === 'viewer' || userProfile?.role === 'editor' || userProfile?.role === 'admin'
  }

  const value: AuthContextType = {
    user,
    userProfile,
    session,
    loading,
    login,
    register,
    logout,
    resetPassword,
    refreshProfile,
    hasPermission,
    isAdmin,
    isEditor,
    isViewer
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthProvider }
export default AuthProvider