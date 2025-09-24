import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Load console sync commands in development
if (import.meta.env.DEV) {
  import('./scripts/runProductSync').then(() => {
    console.log('🔧 Product sync console commands loaded!')
  })
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
