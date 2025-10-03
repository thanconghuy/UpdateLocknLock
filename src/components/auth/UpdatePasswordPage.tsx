import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'

interface UpdatePasswordPageProps {
  onComplete?: () => void
}

export default function UpdatePasswordPage({ onComplete }: UpdatePasswordPageProps) {
  const { updatePassword, user } = useAuth()

  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [errors, setErrors] = useState<{
    newPassword?: string
    confirmPassword?: string
    general?: string
  }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  // Check if user came from email link
  useEffect(() => {
    if (!user) {
      setErrors({
        general:
          'Phiên đặt lại mật khẩu không hợp lệ. Vui lòng yêu cầu email đặt lại mật khẩu mới.'
      })
    }
  }, [user])

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    // Validate new password
    if (!formData.newPassword) {
      newErrors.newPassword = 'Vui lòng nhập mật khẩu mới'
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Mật khẩu phải có ít nhất 8 ký tự'
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.newPassword)) {
      newErrors.newPassword = 'Mật khẩu phải chứa chữ hoa, chữ thường và số'
    }

    // Validate confirm password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Vui lòng nhập lại mật khẩu'
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu không khớp'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccessMessage('')
    setErrors({})

    if (!validateForm()) {
      return
    }

    if (!user) {
      setErrors({ general: 'Không tìm thấy phiên đăng nhập. Vui lòng thử lại.' })
      return
    }

    setIsSubmitting(true)

    try {
      await updatePassword(formData.newPassword)

      setSuccessMessage('✅ Đã đổi mật khẩu thành công! Đang chuyển đến trang đăng nhập...')

      // Clear form
      setFormData({
        newPassword: '',
        confirmPassword: ''
      })

      // Redirect to login after 3 seconds
      setTimeout(() => {
        if (onComplete) {
          onComplete()
        }
      }, 3000)
    } catch (error: any) {
      console.error('Update password error:', error)

      if (error.message?.includes('session')) {
        setErrors({
          general:
            'Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu email đặt lại mật khẩu mới.'
        })
      } else if (error.message?.includes('same password')) {
        setErrors({ general: 'Mật khẩu mới không được trùng với mật khẩu cũ' })
      } else {
        setErrors({ general: error.message || 'Đã xảy ra lỗi khi đổi mật khẩu' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tạo Mật Khẩu Mới</h1>
          <p className="text-gray-600">Nhập mật khẩu mới cho tài khoản của bạn</p>
          {user && (
            <p className="text-sm text-blue-600 mt-2 font-medium">
              Email: {user.email}
            </p>
          )}
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm font-medium">{successMessage}</p>
          </div>
        )}

        {/* Error Message */}
        {errors.general && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm font-medium">❌ {errors.general}</p>
            {errors.general.includes('hết hạn') && (
              <button
                onClick={() => navigate('/reset-password')}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Yêu cầu email mới →
              </button>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* New Password */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Mật khẩu mới
            </label>
            <input
              id="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={(e) => handleInputChange('newPassword', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.newPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Nhập mật khẩu mới"
              disabled={isSubmitting || !user}
            />
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Nhập lại mật khẩu mới
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-300'
              }`}
              placeholder="Nhập lại mật khẩu mới"
              disabled={isSubmitting || !user}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !user}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
              isSubmitting || !user ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
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
                Đang xử lý...
              </span>
            ) : (
              'Cập Nhật Mật Khẩu'
            )}
          </button>

          {/* Back to Login */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              disabled={isSubmitting}
            >
              ← Quay lại đăng nhập
            </button>
          </div>
        </form>

        {/* Security Note */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            🔒 Mật khẩu của bạn được mã hóa và bảo mật tuyệt đối
          </p>
        </div>
      </div>
    </div>
  )
}
