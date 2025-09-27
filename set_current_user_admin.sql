-- Set current user thành admin

-- 1. Kiểm tra user hiện tại
SELECT 'Current user info:' as info, auth.uid()::text as user_id;

-- 2. Kiểm tra user_profiles table
SELECT 'Current user profiles:' as info, '' as id, '' as email, '' as role;
SELECT '', id::text, email, role::text FROM user_profiles;

-- 3. Set user hiện tại thành admin (nếu đã có profile)
UPDATE user_profiles
SET role = 'admin', is_active = true, updated_at = NOW()
WHERE id = auth.uid();

-- 4. Nếu chưa có profile, tạo mới
INSERT INTO user_profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
)
SELECT
    auth.uid(),
    au.email,
    split_part(au.email, '@', 1),
    'admin',
    true,
    NOW(),
    NOW()
FROM auth.users au
WHERE au.id = auth.uid()
AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid());

-- 5. Verify kết quả
SELECT 'Updated user profile:' as info, '' as id, '' as email, '' as role;
SELECT '', id::text, email, role::text
FROM user_profiles
WHERE id = auth.uid();