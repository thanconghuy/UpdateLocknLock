import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthError, User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { UserRole } from '../types/auth'

interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
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
  refreshProfile: async () => {}
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch user profile from database with timeout protection
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      // Add timeout protection for profile fetch
      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('User profile fetch timeout')), 3000)
      )

      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]) as any

      if (error) {
        console.error('❌ Error fetching user profile:', error)
        return null
      }

      return profile as UserProfile
    } catch (error) {
      console.error('❌ Exception fetching user profile:', error)
      return null
    }
  }

  // Refresh user profile
  const refreshProfile = async () => {
    if (!user?.id) return

    const profile = await fetchUserProfile(user.id)
    setUserProfile(profile)
  }

  useEffect(() => {
    // Get initial session with timeout protection
    const getInitialSession = async () => {
      try {
        console.log('🔐 AuthContext: Starting initial session check...')

        // Add timeout protection for getSession
        const sessionPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Session check timeout')), 5000)
        )

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]) as any

        console.log('🔐 AuthContext: Session check complete:', session ? 'Found session' : 'No session')

        setSession(session)
        setUser(session?.user ?? null)

        // Fetch user profile if user exists
        if (session?.user?.id) {
          console.log('🔐 AuthContext: Fetching user profile...')
          const profile = await fetchUserProfile(session.user.id)
          setUserProfile(profile)
          console.log('🔐 AuthContext: User profile loaded:', profile ? 'Success' : 'Failed')
        }

      } catch (error) {
        console.error('❌ AuthContext: Error during initial session check:', error)
        // On error, clear states and continue
        setSession(null)
        setUser(null)
        setUserProfile(null)
      } finally {
        // Always set loading to false, even on error
        console.log('🔐 AuthContext: Initial session check completed, setting loading=false')
        setLoading(false)
      }
    }

    getInitialSession()

    // Emergency timeout to prevent stuck loading state
    const emergencyTimeout = setTimeout(() => {
      console.warn('⚠️ AuthContext: Emergency timeout triggered - forcing loading=false')
      setLoading(false)
    }, 10000) // 10 seconds emergency timeout

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state changed:', event, session?.user?.email)

        // Handle different auth events
        if (event === 'SIGNED_OUT') {
          console.log('🔓 User signed out - clearing all state')
          setSession(null)
          setUser(null)
          setUserProfile(null)
          setLoading(false)
          return
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log(`🔐 ${event} - updating session and profile`)
          setSession(session)
          setUser(session?.user ?? null)

          // Fetch user profile if user exists
          if (session?.user?.id) {
            const profile = await fetchUserProfile(session.user.id)
            setUserProfile(profile)
          } else {
            setUserProfile(null)
          }
        } else {
          // For other events, just update session/user without profile fetch
          setSession(session)
          setUser(session?.user ?? null)
        }

        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(emergencyTimeout)
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        console.error('❌ Login error:', error)
      } else {
        console.log('✅ Login successful for:', email)
      }

      return { error }
    } catch (error) {
      console.error('❌ Login exception:', error)
      return { error: error as AuthError }
    } finally {
      setLoading(false)
    }
  }

  const register = async (email: string, password: string, metadata?: any) => {
    try {
      setLoading(true)
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })

      if (error) {
        console.error('❌ Registration error:', error)
      } else {
        console.log('✅ Registration successful for:', email)
      }

      return { error }
    } catch (error) {
      console.error('❌ Registration exception:', error)
      return { error: error as AuthError }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      console.log('🔓 Starting logout process...')

      // Clear state first to prevent loops
      setUserProfile(null)
      setUser(null)
      setSession(null)

      // Then sign out
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('❌ Logout error:', error)
        throw error
      }

      console.log('✅ Logout successful - state cleared')
    } catch (error) {
      console.error('❌ Logout exception:', error)
      // Reset loading state on error
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        console.error('❌ Reset password error:', error)
      } else {
        console.log('✅ Reset password email sent to:', email)
      }

      return { error }
    } catch (error) {
      console.error('❌ Reset password exception:', error)
      return { error: error as AuthError }
    }
  }

  const value = {
    user,
    userProfile,
    session,
    loading,
    login,
    register,
    logout,
    resetPassword,
    refreshProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export { supabase }
export default AuthContext