# Email-Based Password Reset Implementation

## Overview
Implemented a secure email-based password reset flow using Supabase Auth API, replacing the previous custom SQL approach that was incompatible with Supabase's internal authentication system.

## Implementation Date
2025-10-03

## Flow Description

### Step 1: Request Password Reset
**Component:** `ResetPasswordPage.tsx`
**Path:** `/` (shown via LoginPage when user clicks "Quên mật khẩu?")

1. User enters their email address
2. System calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '/update-password' })`
3. Supabase sends an email with a magic link containing recovery token
4. User sees success message and is instructed to check email

### Step 2: Update Password
**Component:** `UpdatePasswordPage.tsx`
**Detection:** URL hash contains `type=recovery` parameter from email link

1. User clicks link in email
2. Supabase redirects to app with recovery token in URL hash
3. `ProtectedRoute` detects recovery mode and shows `UpdatePasswordPage`
4. User enters new password (must meet strength requirements)
5. System calls `supabase.auth.updateUser({ password: newPassword })`
6. On success, user is redirected back to login page

## Files Modified

### 1. `src/contexts/AuthContext.tsx`
**Changes:**
- Updated `resetPassword(email: string)` - now sends email instead of updating password directly
- Added `updatePassword(newPassword: string)` - updates password after email verification
- Uses Supabase Auth API methods instead of custom SQL

**Key Methods:**
```typescript
const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/update-password`
  })
  if (error) throw new Error(error.message)
}

const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })
  if (error) throw new Error(error.message)
}
```

### 2. `src/components/auth/ResetPasswordPage.tsx`
**Complete Rewrite:**
- Removed password input fields (now email-only)
- Updated UI to show email sending flow
- Added information about 60-minute link expiration
- Shows success message with instructions to check email

**Key Features:**
- Email validation
- Auto-redirect to login after 5 seconds on success
- Instructions to check Spam folder
- Rate limiting error handling

### 3. `src/components/auth/UpdatePasswordPage.tsx`
**New Component:**
- Password strength validation (min 8 chars, requires uppercase, lowercase, number)
- Session validation (ensures user came from valid email link)
- Error handling for expired sessions
- Success message with auto-redirect
- Uses `onComplete` callback instead of router navigation

**Password Validation:**
- Minimum 8 characters
- Must contain uppercase letter
- Must contain lowercase letter
- Must contain number
- Passwords must match

### 4. `src/components/auth/ProtectedRoute.tsx`
**Changes:**
- Added `UpdatePasswordPage` import
- Added recovery mode detection via URL hash
- Shows `UpdatePasswordPage` when `type=recovery` detected in URL

**Recovery Detection:**
```typescript
useEffect(() => {
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const type = hashParams.get('type')

  if (type === 'recovery') {
    setIsPasswordRecovery(true)
  }
}, [])
```

### 5. `src/components/auth/LoginPage.tsx`
**No Changes Required:**
- Already had `ResetPasswordPage` integration
- "Quên mật khẩu?" button triggers reset flow

## Configuration Required

### Supabase Dashboard Settings
**Auth > Email Templates > Reset Password**

Ensure the redirect URL is configured:
```
{{ .SiteURL }}/update-password#type=recovery&access_token={{ .Token }}&refresh_token={{ .RefreshToken }}
```

Or use the default Supabase template which includes the recovery hash parameters.

### Email Provider
Ensure email provider is configured in Supabase:
- Auth > Providers > Email
- Enable "Enable Email Provider"
- Configure SMTP settings or use Supabase's built-in email

## Security Features

1. **Token-Based Authentication**
   - Uses Supabase's secure recovery tokens
   - Tokens expire after 60 minutes
   - One-time use tokens

2. **Password Strength Requirements**
   - Minimum 8 characters
   - Must include uppercase, lowercase, and numbers
   - Validated on both client and server

3. **Session Validation**
   - Verifies user has valid session from email link
   - Prevents unauthorized password updates
   - Clear error messages for expired sessions

4. **Rate Limiting**
   - Supabase automatically rate-limits password reset requests
   - Prevents abuse and spam

## User Experience

### Vietnamese Language Support
All UI text is in Vietnamese:
- "Đặt Lại Mật Khẩu" (Reset Password)
- "Email đặt lại mật khẩu đã được gửi!" (Password reset email sent!)
- "Phiên đặt lại mật khẩu đã hết hạn" (Password reset session expired)

### Error Handling
- Email not found: "Email không tồn tại trong hệ thống"
- Rate limiting: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau."
- Session expired: "Phiên đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu email mới."
- Weak password: "Mật khẩu phải chứa chữ hoa, chữ thường và số"

### Success Messages
- Email sent: "✅ Email đặt lại mật khẩu đã được gửi!"
- Password updated: "✅ Đã đổi mật khẩu thành công!"
- Auto-redirect with countdown

## Testing Checklist

- [ ] Request password reset email
- [ ] Check email arrives (check Spam folder)
- [ ] Click link in email
- [ ] Verify UpdatePasswordPage loads
- [ ] Test password validation (too short, no uppercase, etc.)
- [ ] Test password mismatch error
- [ ] Successfully update password
- [ ] Verify redirect to login page
- [ ] Login with new password
- [ ] Test expired token (wait 60+ minutes)
- [ ] Test rate limiting (multiple requests quickly)

## Advantages Over Custom SQL Approach

1. **Compatibility:** Works perfectly with Supabase Auth system
2. **Security:** Uses proven, audited authentication flows
3. **Maintenance:** No custom SQL functions to maintain
4. **Email Templates:** Supabase provides customizable email templates
5. **Rate Limiting:** Built-in protection against abuse
6. **Token Management:** Automatic token expiration and cleanup
7. **Audit Trail:** Supabase logs all authentication events

## Files No Longer Used

The following SQL migration files are no longer needed:
- `migrations/create_reset_password_function.sql`
- `migrations/create_reset_password_function_simple.sql`
- `migrations/fix_reset_password_gen_salt.sql`
- `migrations/reset_password_direct_update.sql`
- `migrations/fix_reset_password_clear_tokens.sql`
- `migrations/fix_reset_password_final.sql`
- `migrations/reset_password_production_ready.sql`
- `migrations/fix_function_permissions.sql`
- `migrations/clear_sessions_fixed.sql`
- `migrations/clear_sessions_with_cast.sql`
- `fix_pgcrypto_extension.sql`

These can be archived or removed as they are replaced by Supabase Auth API.

## Support

For issues or questions:
1. Check Supabase Auth documentation
2. Verify email provider configuration
3. Check browser console for detailed error messages
4. Verify user has valid email in system

## Next Steps

1. Test the complete flow end-to-end
2. Customize email templates in Supabase Dashboard
3. Add analytics/logging for password reset events
4. Consider adding 2FA for additional security
