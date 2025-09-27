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
}

console.log('🚀 App starting with debug tools...')

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
