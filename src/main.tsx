import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Debug tools disabled to prevent auto-run conflicts and cache issues
// To enable specific tools, uncomment the imports below
if (import.meta.env.DEV) {
  console.log('🔧 Debug tools available but not auto-loaded to prevent cache conflicts')
  console.log('💡 To use debug tools, manually import them in browser console')

  // Uncomment specific tools as needed:

  // import('./scripts/runProductSync').then(() => {
  //   console.log('🔧 Product sync console commands loaded!')
  // }).catch(err => console.warn('⚠️ Product sync tools failed to load:', err))

  // import('./scripts/simpleDiagnostic').then(() => {
  //   console.log('🔧 Simple diagnostic tools loaded!')
  // }).catch(err => console.warn('⚠️ Diagnostic tools failed to load:', err))

  import('./scripts/clearBrowserState').then(() => {
    console.log('🧹 Browser state cleaner loaded! Use clearBrowserState() in console.')
  }).catch(err => console.warn('⚠️ Browser state cleaner failed to load:', err))

  // import('./scripts/testWooCommerceConnection').then(() => {
  //   console.log('🧪 WooCommerce connection test loaded!')
  // }).catch(err => console.warn('⚠️ WooCommerce test failed to load:', err))

  // import('./scripts/testWooCommerceManual').then(() => {
  //   console.log('🧪 Manual WooCommerce test loaded!')
  // }).catch(err => console.warn('⚠️ Manual WooCommerce test failed to load:', err))

  // import('./scripts/testProjectSwitching').then(() => {
  //   console.log('🧪 Project switching test loaded!')
  // }).catch(err => console.warn('⚠️ Project switching test failed to load:', err))

  // import('./scripts/debugProjectSwitching').then(() => {
  //   console.log('🔍 Project switching debug loaded!')
  // }).catch(err => console.warn('⚠️ Project switching debug failed to load:', err))

  // import('./scripts/quickProjectCheck').then(() => {
  //   console.log('⚡ Quick project check loaded!')
  // }).catch(err => console.warn('⚠️ Quick project check failed to load:', err))

  // import('./scripts/testProjectIsolation').then(() => {
  //   console.log('🧪 Project isolation test loaded!')
  // }).catch(err => console.warn('⚠️ Project isolation test failed to load:', err))
}

console.log('🚀 App starting with debug tools...')

// Check if we're in password recovery mode
function isPasswordRecoveryMode(): boolean {
  if (typeof window === 'undefined') return false
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const searchParams = new URLSearchParams(window.location.search)
  const typeFromHash = hashParams.get('type')
  const typeFromQuery = searchParams.get('type')
  const code = searchParams.get('code')
  const pathname = window.location.pathname
  const isRecoveryByType = typeFromHash === 'recovery' || typeFromQuery === 'recovery'
  const isRecoveryByPath = !!(code && pathname === '/update-password')
  return isRecoveryByType || isRecoveryByPath
}

// Render WITHOUT StrictMode in recovery mode to prevent double PKCE execution
if (isPasswordRecoveryMode()) {
  console.log('🔐 Password recovery mode - rendering WITHOUT StrictMode to prevent double PKCE execution')
  createRoot(document.getElementById('root')!).render(<App />)
} else {
  console.log('✅ Normal mode - rendering with StrictMode')
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
