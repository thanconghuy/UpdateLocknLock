// Clear browser state to fix loading issues

import { supabase } from '../lib/supabase'

async function clearAllBrowserState(): Promise<void> {
  try {
    console.log('🧹 Starting browser state cleanup...')

    // 1. Sign out from Supabase
    console.log('🔓 Signing out from Supabase...')
    await supabase.auth.signOut()

    // 2. Clear localStorage
    console.log('🗑️ Clearing localStorage...')
    localStorage.clear()

    // 3. Clear sessionStorage
    console.log('🗑️ Clearing sessionStorage...')
    sessionStorage.clear()

    // 4. Clear IndexedDB (Supabase cache)
    console.log('🗑️ Clearing IndexedDB...')
    try {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name) {
          indexedDB.deleteDatabase(db.name)
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not clear IndexedDB:', error)
    }

    // 5. Clear service workers
    console.log('🗑️ Clearing service workers...')
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const registration of registrations) {
        await registration.unregister()
      }
    }

    console.log('✅ Browser state cleared successfully')
    console.log('🔄 Reloading page in 2 seconds...')

    // 6. Force reload after delay
    setTimeout(() => {
      window.location.href = window.location.origin
    }, 2000)

  } catch (error) {
    console.error('❌ Error clearing browser state:', error)
    console.log('🔄 Force reloading anyway...')
    setTimeout(() => {
      window.location.href = window.location.origin
    }, 1000)
  }
}

async function quickClearAndReload(): Promise<void> {
  console.log('⚡ Quick clear and reload...')
  localStorage.clear()
  sessionStorage.clear()
  await supabase.auth.signOut()
  window.location.href = window.location.origin + '?t=' + Date.now()
}

// Export to window for console access
declare global {
  interface Window {
    clearBrowserState: {
      full: () => Promise<void>
      quick: () => Promise<void>
    }
  }
}

window.clearBrowserState = {
  full: clearAllBrowserState,
  quick: quickClearAndReload
}

console.log('🧹 Browser state cleaner loaded! Use:')
console.log('  window.clearBrowserState.quick() - Quick clear and reload')
console.log('  window.clearBrowserState.full() - Full cleanup')