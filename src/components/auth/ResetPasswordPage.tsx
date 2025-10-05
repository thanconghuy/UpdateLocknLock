import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface ResetPasswordPageProps {
  onBack?: () => void
}

export default function ResetPasswordPage({ onBack }: ResetPasswordPageProps) {
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<{ email?: string; general?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0)

  const validateEmail = (email: string): boolean => {
    if (!email.trim()) {
      setErrors({ email: 'Vui lòng nhập email' })
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Email không hợp lệ' })
      return false
    }
    return true
  }

  // Countdown timer effect
  React.useEffect(() => {
    if (rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown(rateLimitCountdown - 1)
        if (rateLimitCountdown === 1) {
          // Clear error when countdown reaches 0
          setErrors({})
        }
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [rateLimitCountdown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage('')
    setErrors({})
    setRateLimitCountdown(0)

    if (!validateEmail(email)) {
      return
    }

    setIsSubmitting(true)

    try {
      await resetPassword(email)

      setSuccessMessage(
        '✅ Email đặt lại mật khẩu đã được gửi! Vui lòng kiểm tra hộp thư của bạn và click vào link trong email để đặt lại mật khẩu.'
      )

      // Clear form
      setEmail('')

      // Auto redirect to login after 5 seconds
      setTimeout(() => {
        if (onBack) {
          onBack()
        }
      }, 5000)
    } catch (error: any) {
      console.error('Reset password error:', error)

      const errorMsg = error.message?.toLowerCase() || ''

      if (errorMsg.includes('not found') || errorMsg.includes('không tìm thấy')) {
        setErrors({ general: 'Email không tồn tại trong hệ thống' })
      } else if (errorMsg.includes('rate limit') || errorMsg.includes('email_send_rate_limit')) {
        setErrors({
          general:
            'Bạn đã yêu cầu quá nhiều lần. Vui lòng đợi 60 giây rồi thử lại.'
        })
        // Start countdown timer
        setRateLimitCountdown(60)
      } else if (errorMsg.includes('over_email_send_rate_limit')) {
        setErrors({
          general:
            'Giới hạn gửi email đã vượt quá mức cho phép. Vui lòng đợi 1 phút rồi thử lại.'
        })
        setRateLimitCountdown(60)
      } else {
        setErrors({ general: error.message || 'Đã xảy ra lỗi khi gửi email đặt lại mật khẩu' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Đặt Lại Mật Khẩu</h1>
          <p className="text-gray-600">
            Nhập email của bạn, chúng tôi sẽ gửi link đặt lại mật khẩu
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm font-medium">{successMessage}</p>
            <p className="text-green-700 text-xs mt-2">
              📧 Kiểm tra cả thư mục Spam nếu không thấy email
            </p>
          </div>
        )}

        {/* Error Message */}
        {errors.general && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm font-medium whitespace-pre-line">
              {rateLimitCountdown > 0 ? '⏱️' : '❌'} {errors.general}
            </p>
            {rateLimitCountdown > 0 && (
              <div className="mt-3">
                <p className="text-red-700 text-xs mb-2">
                  💡 Mẹo: Kiểm tra email trước đó trong hộp thư hoặc thư mục Spam.
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-red-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-red-600 h-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(rateLimitCountdown / 60) * 100}%` }}
                    />
                  </div>
                  <span className="text-red-700 text-sm font-mono font-bold min-w-[3ch]">
                    {rateLimitCountdown}s
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email đăng ký
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email) setErrors({ ...errors, email: undefined })
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="email@example.com"
              disabled={isSubmitting || !!successMessage}
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !!successMessage || rateLimitCountdown > 0}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
              isSubmitting || successMessage || rateLimitCountdown > 0
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Đang gửi email...
              </span>
            ) : successMessage ? (
              '✅ Email đã gửi'
            ) : (
              'Gửi Email Đặt Lại Mật Khẩu'
            )}
          </button>

          {/* Back to Login */}
          {onBack && (
            <div className="text-center">
              <button
                type="button"
                onClick={onBack}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                disabled={isSubmitting}
              >
                ← Quay lại đăng nhập
              </button>
            </div>
          )}
        </form>

        {/* Info Box */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-xs text-blue-800 font-medium mb-2">💡 Lưu ý:</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Link đặt lại mật khẩu có hiệu lực trong 60 phút</li>
              <li>• Nếu không nhận được email, kiểm tra thư mục Spam</li>
              <li>• Bạn có thể yêu cầu email mới sau 60 giây</li>
            </ul>
          </div>
        </div>

        {/* Security Note */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">🔒 Liên kết được mã hóa và bảo mật tuyệt đối</p>
        </div>
      </div>
    </div>
  )
}
