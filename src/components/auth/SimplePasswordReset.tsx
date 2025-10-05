import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface SimplePasswordResetProps {
  onComplete?: () => void
}

/**
 * SIMPLE Password Reset Component
 *
 * How it works:
 * 1. User clicks email link with PKCE code
 * 2. Supabase automatically exchanges code for session
 * 3. We just detect the session and show the form
 * 4. User updates password
 * 5. Done!
 */
export default function SimplePasswordReset({ onComplete }: SimplePasswordResetProps) {
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  // Check if we have a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          console.log('✅ Recovery session found:', session.user.email)
          setEmail(session.user.email || '')
        } else {
          console.log('❌ No session found')
          setError('Link đã hết hạn hoặc không hợp lệ. Vui lòng yêu cầu email mới.')
        }
      } catch (err) {
        console.error('Error checking session:', err)
        setError('Có lỗi xảy ra. Vui lòng thử lại.')
      } finally {
        setCheckingSession(false)
      }
    }

    checkSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (newPassword.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự')
      return
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError('Mật khẩu phải chứa chữ hoa, chữ thường và số')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu không khớp')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      console.log('✅ Password updated successfully')
      setSuccess(true)

      // Redirect after 2 seconds
      setTimeout(async () => {
        await supabase.auth.signOut()
        if (onComplete) {
          onComplete()
        } else {
          window.location.href = '/'
        }
      }, 2000)

    } catch (err: any) {
      console.error('Error updating password:', err)
      setError(err.message || 'Đã xảy ra lỗi khi đổi mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium text-gray-800">Đang xác thực...</h2>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="text-green-600 text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Thành công!</h2>
          <p className="text-gray-600">Mật khẩu đã được cập nhật. Đang chuyển về trang đăng nhập...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Đặt Mật Khẩu Mới</h1>
          <p className="text-gray-600">Nhập mật khẩu mới cho tài khoản của bạn</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">❌ {error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mật khẩu mới</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập mật khẩu mới"
              disabled={loading || !email}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nhập lại mật khẩu</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập lại mật khẩu mới"
              disabled={loading || !email}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
              loading || !email ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Đang xử lý...' : 'Cập Nhật Mật Khẩu'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-blue-600 hover:text-blue-800">
            ← Quay lại đăng nhập
          </a>
        </div>
      </div>
    </div>
  )
}
