import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PasswordGenerator } from '../../utils/passwordGenerator'

interface ChangePasswordPageProps {
  onPasswordChanged: () => void
  userEmail: string
}

export default function ChangePasswordPage({ onPasswordChanged, userEmail }: ChangePasswordPageProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)

  const [passwordStrength, setPasswordStrength] = useState({
    isStrong: false,
    score: 0,
    feedback: [] as string[]
  })

  const handlePasswordChange = (password: string) => {
    setNewPassword(password)
    const strength = PasswordGenerator.validateStrength(password)
    setPasswordStrength(strength)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (!passwordStrength.isStrong) {
      setError('Password is not strong enough. Please follow the guidelines below.')
      return
    }

    setLoading(true)

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        throw updateError
      }

      // Update must_change_password flag in user profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ must_change_password: false })
          .eq('id', user.id)

        if (profileError) {
          console.error('Failed to update profile flag:', profileError)
          // Continue anyway as password was changed successfully
        }
      }

      // Success - callback to parent
      onPasswordChanged()

    } catch (err: any) {
      console.error('Password change error:', err)
      setError(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Password Change Required
          </h1>
          <p className="text-gray-600 text-sm">
            For security reasons, you must change your temporary password before continuing.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Logged in as: <span className="font-medium">{userEmail}</span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Password
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Password
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your current password"
            />
          </div> */}

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Password *
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => handlePasswordChange(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter your new password"
            />

            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Password Strength:</span>
                  <span className={`text-xs font-medium ${
                    passwordStrength.score >= 70 ? 'text-green-600' :
                    passwordStrength.score >= 50 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {passwordStrength.score >= 70 ? 'Strong' :
                     passwordStrength.score >= 50 ? 'Medium' :
                     'Weak'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      passwordStrength.score >= 70 ? 'bg-green-500' :
                      passwordStrength.score >= 50 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${passwordStrength.score}%` }}
                  />
                </div>
                {passwordStrength.feedback.length > 0 && (
                  <ul className="mt-2 text-xs text-gray-600 space-y-1">
                    {passwordStrength.feedback.map((fb, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-red-500 mr-1">•</span>
                        {fb}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm New Password *
            </label>
            <input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Confirm your new password"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-600">Passwords do not match</p>
            )}
          </div>

          {/* Show Password Toggle */}
          <div className="flex items-center">
            <input
              type="checkbox"
              id="showPasswords"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="showPasswords" className="ml-2 text-sm text-gray-700">
              Show passwords
            </label>
          </div>

          {/* Password Requirements */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Password Requirements:</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• At least 12 characters (8 minimum)</li>
              <li>• Include uppercase and lowercase letters</li>
              <li>• Include at least one number</li>
              <li>• Include at least one special character (!@#$%^&*-_=+?)</li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !passwordStrength.isStrong || newPassword !== confirmPassword}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
              loading || !passwordStrength.isStrong || newPassword !== confirmPassword
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Changing Password...' : 'Change Password & Continue'}
          </button>
        </form>

        {/* Security Note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            🔒 Your password is encrypted and secure
          </p>
        </div>
      </div>
    </div>
  )
}
