# 🔐 User Password Auto-Generation & Force Change Guide

## 📋 Tổng quan

Hệ thống đã được cập nhật với tính năng **tự động generate password** cho user mới và **bắt buộc đổi password** khi login lần đầu.

---

## ✨ Tính năng mới

### 1. **Auto-Generate Secure Password**
- Khi Admin tạo user mới **KHÔNG CẦN** nhập password
- Hệ thống tự động generate password mạnh (14 ký tự)
- Password bao gồm:
  - Chữ hoa (A-Z)
  - Chữ thường (a-z)
  - Số (2-9, loại trừ 0,1)
  - Ký tự đặc biệt (!@#$%^&*-_=+?)
  - Loại trừ ký tự dễ nhầm lẫn (i, l, 1, L, o, 0, O)

### 2. **Force Password Change on First Login**
- User với password được generate tự động sẽ bị **bắt buộc đổi password** khi login lần đầu
- UI hiển thị password strength meter
- Yêu cầu password mới phải đủ mạnh (score >= 70%)
- Sau khi đổi password thành công, user được phép truy cập hệ thống

### 3. **Secure Password Display**
- Khi tạo user thành công, Admin sẽ thấy generated password trong thông báo
- ⚠️ **QUAN TRỌNG**: Admin phải save/copy password ngay vì chỉ hiển thị 1 lần
- Password được hiển thị trong success message với format rõ ràng

---

## 🚀 Hướng dẫn Setup

### Bước 1: Chạy SQL Migration

**Chạy script SQL để thêm column `must_change_password`:**

```bash
# Truy cập Supabase Dashboard > SQL Editor
# Copy và run file: add_must_change_password.sql
```

Hoặc chạy SQL trực tiếp:

```sql
-- Add must_change_password column
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_must_change_password
ON user_profiles(must_change_password)
WHERE must_change_password = TRUE;

-- Update existing users
UPDATE user_profiles
SET must_change_password = FALSE
WHERE must_change_password IS NULL;
```

### Bước 2: Verify Database Schema

Kiểm tra column đã được tạo:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name = 'must_change_password';
```

### Bước 3: Test Tạo User Mới

1. Login với tài khoản Admin
2. Vào **User Management**
3. Click **Create New User**
4. Nhập:
   - Email
   - Full Name
   - Role
5. **KHÔNG** nhập password (để trống)
6. Submit

**Kết quả mong đợi:**
```
User test@example.com created successfully!

🔑 Generated Password: AbC-3Def@5GhI7

⚠️ IMPORTANT: Save this password now!
User will be required to change it on first login.
```

### Bước 4: Test Force Password Change

1. Logout khỏi account Admin
2. Login bằng account vừa tạo với generated password
3. Hệ thống sẽ redirect đến **Change Password Page**
4. Nhập new password (phải đủ mạnh)
5. Confirm password
6. Submit
7. Sau khi đổi password thành công → redirect vào app bình thường

---

## 📝 Quy trình tạo User mới (Admin)

```
1. Admin: Vào User Management → Create New User
2. Admin: Nhập Email, Name, Role
3. System: Auto-generate secure password (14 chars)
4. System: Create Supabase Auth user
5. System: Create user_profiles với must_change_password = true
6. System: Hiển thị generated password cho Admin
7. Admin: SAVE password và gửi cho user qua email/chat
```

---

## 📝 Quy trình Login lần đầu (User)

```
1. User: Nhận email + temp password từ Admin
2. User: Login với temp password
3. System: Check must_change_password = true
4. System: Redirect to Change Password Page
5. User: Nhập new password (phải strong)
6. System: Update password
7. System: Set must_change_password = false
8. System: Redirect to Dashboard
9. User: Sử dụng app bình thường
```

---

## 🔧 Files đã thay đổi

### 1. **New Files**
- `/src/utils/passwordGenerator.ts` - Password generation utility
- `/src/components/auth/ChangePasswordPage.tsx` - Force change password UI
- `/add_must_change_password.sql` - Database migration

### 2. **Updated Files**
- `/src/types/userManagement.ts` - Added password & must_change_password fields
- `/src/services/UserDataService.ts` - Added password generation logic
- `/src/components/admin/UserManagement.tsx` - Display generated password
- `/src/components/auth/ProtectedRoute.tsx` - Check must_change_password flag
- `/src/contexts/AuthContext.tsx` - Added isEditor, isViewer functions

### 3. **Database Changes**
- `user_profiles` table: Added `must_change_password BOOLEAN` column

---

## 🔒 Security Best Practices

✅ **Đã implement:**
- Auto-generate strong passwords (14+ characters)
- Exclude similar/ambiguous characters
- Force password change on first login
- Password strength validation
- Encrypted passwords (Supabase Auth)
- One-time password display

⚠️ **Khuyến nghị thêm (optional):**
- Setup Email service để gửi password tự động
- Password expiration policy
- Password history (không cho dùng lại password cũ)
- Two-Factor Authentication (2FA)
- IP whitelist cho Admin accounts

---

## 🧪 Testing Checklist

- [ ] SQL migration chạy thành công
- [ ] Tạo user mới không nhập password
- [ ] System generate password tự động
- [ ] Admin thấy generated password trong success message
- [ ] Login với generated password
- [ ] Redirect to Change Password Page
- [ ] Password strength meter hoạt động
- [ ] Đổi password thành công
- [ ] `must_change_password` = false sau khi đổi
- [ ] User access app bình thường sau khi đổi password
- [ ] Login lần 2 không bị force change nữa

---

## ❓ Troubleshooting

### Issue 1: "supabase.auth.admin is not a function"
**Giải pháp:** Đảm bảo sử dụng Supabase Service Role Key (không phải anon key)

### Issue 2: Generated password không hiển thị
**Giải pháp:** Check console logs, verify return value từ createUser()

### Issue 3: User không bị force change password
**Giải pháp:**
- Check `must_change_password` column trong database
- Verify ProtectedRoute đã import ChangePasswordPage

### Issue 4: Password strength luôn weak
**Giải pháp:** Đảm bảo password có:
- 12+ ký tự
- Uppercase + lowercase
- Numbers + symbols

---

## 📞 Support

Nếu gặp vấn đề, check:
1. Browser Console (F12) để xem errors
2. Supabase Logs để xem Auth errors
3. Database để verify `must_change_password` flag

---

**Last Updated:** 2025-10-01
**Version:** 1.0.0
