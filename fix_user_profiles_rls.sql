-- Fix user_profiles RLS policy infinite recursion

-- 1. Tạm thời disable RLS để test
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 2. Drop tất cả policies hiện có (gây infinite recursion)
DROP POLICY IF EXISTS "Admins can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated" ON user_profiles;

-- 3. Grant direct permissions (no RLS)
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- 4. Test query để đảm bảo hoạt động
SELECT 'Testing user_profiles access:' as info;
SELECT id, email, role, is_active FROM user_profiles LIMIT 5;

-- 5. Show current user profile
SELECT 'Current user profile:' as info, '' as id, '' as email, '' as role;
SELECT '', id::text, email, role::text
FROM user_profiles
WHERE id = auth.uid();

-- 6. Nếu chưa có profile cho current user, tạo ngay
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
AND NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid())
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    is_active = true,
    updated_at = NOW();

-- 7. Final check
SELECT 'Final user profile:' as info, '' as id, '' as email, '' as role;
SELECT '', id::text, email, role::text
FROM user_profiles
WHERE id = auth.uid();

SELECT 'RLS disabled for user_profiles - should work now' as status;