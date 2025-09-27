-- SQL Script để cập nhật user thành admin
-- Chạy trong Supabase SQL Editor

-- 1. Kiểm tra user hiện tại trước khi update
SELECT
    up.id,
    up.email,
    up.full_name,
    up.role as current_role,
    up.is_active,
    up.created_at,
    au.email_confirmed_at,
    au.created_at as auth_created_at
FROM user_profiles up
LEFT JOIN auth.users au ON up.id = au.id
WHERE up.email = 'vtphong91@gmail.com';

-- 2. Nếu user_profiles chưa có record, tạo mới
INSERT INTO user_profiles (id, email, full_name, role, is_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'Admin Phong'),
    'admin'::user_role,
    true
FROM auth.users au
WHERE au.email = 'vtphong91@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.email = 'vtphong91@gmail.com'
);

-- 3. Cập nhật role thành admin cho user đã tồn tại
UPDATE user_profiles
SET
    role = 'admin'::user_role,
    updated_at = now(),
    is_active = true
WHERE email = 'vtphong91@gmail.com';

-- 4. Kiểm tra kết quả sau khi update
SELECT
    up.id,
    up.email,
    up.full_name,
    up.role,
    up.is_active,
    up.created_at,
    up.updated_at,
    au.email_confirmed_at,
    CASE
        WHEN au.email_confirmed_at IS NOT NULL THEN '✅ Email đã xác thực'
        ELSE '⚠️ Email chưa xác thực'
    END as email_status
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE up.email = 'vtphong91@gmail.com';

-- 5. Kiểm tra tất cả users có role admin
SELECT
    email,
    full_name,
    role,
    is_active,
    created_at
FROM user_profiles
WHERE role = 'admin'
ORDER BY created_at;