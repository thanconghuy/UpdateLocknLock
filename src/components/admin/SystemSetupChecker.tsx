import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface SystemSetupCheckerProps {
  onSetupComplete: () => void
}

export default function SystemSetupChecker({ onSetupComplete }: SystemSetupCheckerProps) {
  const [checking, setChecking] = useState(true)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkSystemSetup()
  }, [])

  const createSystemTable = async () => {
    setChecking(true)
    setError(null)

    try {
      console.log('🔨 SystemSetupChecker: Attempting to create system_settings table...')

      // Auto-create system_settings table with minimal setup
      const createTableSQL = `
        -- Create system_settings table for admin configuration
        CREATE TABLE IF NOT EXISTS system_settings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            category VARCHAR(50) NOT NULL UNIQUE,
            config_data TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
            CONSTRAINT category_check CHECK (category IN ('database', 'woocommerce'))
        );

        -- Create index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
        CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at);

        -- Enable Row Level Security
        ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

        -- Create policy: Only admins can access system settings
        DROP POLICY IF EXISTS "Admin only access to system_settings" ON system_settings;
        CREATE POLICY "Admin only access to system_settings"
        ON system_settings
        FOR ALL
        TO authenticated
        USING (
            EXISTS (
                SELECT 1
                FROM user_profiles
                WHERE user_profiles.id = auth.uid()
                AND user_profiles.role = 'admin'
                AND user_profiles.is_active = true
            )
        );

        -- Grant permissions
        GRANT ALL ON system_settings TO authenticated;
        GRANT ALL ON system_settings TO service_role;
      `

      const { error } = await supabase.rpc('exec_sql', { sql: createTableSQL })

      if (error) {
        console.error('❌ Failed to create system_settings table:', error)
        setError(`Không thể tự động tạo bảng: ${error.message}. Vui lòng tạo thủ công qua Supabase Dashboard.`)
      } else {
        console.log('✅ system_settings table created successfully')
        // Check setup again
        await checkSystemSetup()
      }
    } catch (error: any) {
      console.error('❌ Exception creating system_settings table:', error)
      setError(`Exception: ${error.message}. Vui lòng tạo thủ công qua Supabase Dashboard.`)
    } finally {
      setChecking(false)
    }
  }

  const checkSystemSetup = async () => {
    try {
      console.log('🔍 SystemSetupChecker: Checking if system_settings table exists...')

      // Add shorter timeout to prevent blocking UI
      const checkPromise = supabase
        .from('system_settings')
        .select('id')
        .limit(1)

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('System setup check timed out after 2 seconds')), 2000)
      )

      const { data, error } = await Promise.race([checkPromise, timeoutPromise]) as any

      if (error) {
        if (error.message?.includes('timed out')) {
          console.error('❌ SystemSetupChecker: Timeout - skipping setup check')
          console.log('🔄 SystemSetupChecker: Assuming system is ready due to timeout')
          setChecking(false)
          onSetupComplete() // Skip setup and continue
          return
        } else if (error.code === '42P01' || error.message?.includes('relation') && error.message?.includes('does not exist')) {
          console.log('⚠️ SystemSetupChecker: system_settings table does not exist')
          setSetupNeeded(true)
        } else {
          console.error('❌ SystemSetupChecker: Error checking system setup:', error)
          setError(`Lỗi kiểm tra hệ thống: ${error.message}`)
        }
      } else {
        console.log('✅ SystemSetupChecker: system_settings table exists')
        onSetupComplete()
      }
    } catch (error: any) {
      console.error('❌ SystemSetupChecker: Exception checking system setup:', error)
      if (error.message?.includes('timed out')) {
        setError('Timeout kiểm tra database. Có thể do kết nối chậm hoặc database không khả dụng.')
      } else {
        setError(`Exception: ${error.message}`)
      }
    } finally {
      setChecking(false)
    }
  }

  if (checking) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <div>
            <h3 className="font-medium text-blue-800">Đang kiểm tra hệ thống...</h3>
            <p className="text-sm text-blue-600">Vui lòng đợi trong giây lát</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-red-500 text-xl">❌</span>
          <div>
            <h3 className="font-medium text-red-800">Lỗi Hệ Thống</h3>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              onClick={checkSystemSetup}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Thử Lại
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (setupNeeded) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <span className="text-yellow-600 text-xl">⚠️</span>
          <div>
            <h3 className="font-medium text-yellow-800">Cần Thiết Lập Hệ Thống</h3>
            <p className="text-sm text-yellow-700 mt-1">
              Bảng <code>system_settings</code> chưa được tạo. Bạn cần chạy script thiết lập.
            </p>

            <div className="mt-4 bg-yellow-100 border border-yellow-300 rounded p-3">
              <p className="text-sm font-medium text-yellow-800 mb-2">Hướng dẫn:</p>
              <ol className="text-sm text-yellow-700 space-y-1 ml-4">
                <li>1. Mở Supabase Dashboard → SQL Editor</li>
                <li>2. Copy và paste nội dung file <code>setup_admin_settings.sql</code></li>
                <li>3. Nhấn "Run" để tạo bảng và policies</li>
                <li>4. Quay lại đây và nhấn "Kiểm Tra Lại"</li>
              </ol>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={createSystemTable}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={checking}
              >
                🔨 Tự Động Tạo Bảng
              </button>
              <button
                onClick={checkSystemSetup}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                🔄 Kiểm Tra Lại
              </button>
              <button
                onClick={onSetupComplete}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ⏭️ Bỏ Qua (Debug)
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}