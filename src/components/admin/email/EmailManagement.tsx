import React, { useState } from 'react'
import EmailSettings from './EmailSettings'
import EmailTemplates from './EmailTemplates'
import EmailLogs from './EmailLogs'

type TabType = 'settings' | 'templates' | 'logs'

export default function EmailManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('settings')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">📧 Email Management</h2>
        <p className="text-gray-600 mt-1">Quản lý cấu hình email và templates</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('settings')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'settings'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            ⚙️ Email Settings
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'templates'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📝 Email Templates
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'logs'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            📊 Email Logs
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'settings' && <EmailSettings />}
        {activeTab === 'templates' && <EmailTemplates />}
        {activeTab === 'logs' && <EmailLogs />}
      </div>
    </div>
  )
}
