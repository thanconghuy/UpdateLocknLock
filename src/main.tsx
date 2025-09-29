import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Re-enable debug tools (but ensure they don't auto-run tests)
if (import.meta.env.DEV) {
  import('./scripts/runProductSync').then(() => {
    console.log('🔧 Product sync console commands loaded!')
  }).catch(err => console.warn('⚠️ Product sync tools failed to load:', err))

  import('./scripts/simpleDiagnostic').then(() => {
    console.log('🔧 Simple diagnostic tools loaded!')
  }).catch(err => console.warn('⚠️ Diagnostic tools failed to load:', err))

  import('./scripts/clearBrowserState').then(() => {
    console.log('🧹 Browser state cleaner loaded!')
  }).catch(err => console.warn('⚠️ Browser state cleaner failed to load:', err))

  import('./scripts/testWooCommerceConnection').then(() => {
    console.log('🧪 WooCommerce connection test loaded!')
  }).catch(err => console.warn('⚠️ WooCommerce test failed to load:', err))

  import('./scripts/testWooCommerceManual').then(() => {
    console.log('🧪 Manual WooCommerce test loaded!')
  }).catch(err => console.warn('⚠️ Manual WooCommerce test failed to load:', err))

  import('./scripts/testProjectSwitching').then(() => {
    console.log('🧪 Project switching test loaded!')
  }).catch(err => console.warn('⚠️ Project switching test failed to load:', err))

  import('./scripts/debugProjectSwitching').then(() => {
    console.log('🔍 Project switching debug loaded!')
  }).catch(err => console.warn('⚠️ Project switching debug failed to load:', err))

  import('./scripts/quickProjectCheck').then(() => {
    console.log('⚡ Quick project check loaded!')
  }).catch(err => console.warn('⚠️ Quick project check failed to load:', err))

  import('./scripts/testProjectIsolation').then(() => {
    console.log('🧪 Project isolation test loaded!')
  }).catch(err => console.warn('⚠️ Project isolation test failed to load:', err))

  // Simple ProductService test script removed
  console.log('🧪 Simple ProductService test script was removed')

  // Debug script removed
  console.log('🔍 Project permissions debug script was removed')
}

console.log('🚀 App starting with debug tools...')

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
