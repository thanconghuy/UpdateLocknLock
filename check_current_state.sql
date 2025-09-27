-- ====================================
-- KIỂM TRA TRẠNG THÁI HIỆN TẠI
-- ====================================

-- 1. Kiểm tra tất cả columns có chứa 'role'
SELECT
    '=== TẤT CẢ COLUMNS ROLE ===' as section,
    column_name,
    data_type,
    udt_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name LIKE '%role%'
ORDER BY column_name;

-- 2. Kiểm tra tất cả enum types
SELECT
    '=== TẤT CẢ ENUM TYPES ===' as section,
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname LIKE '%role%'
GROUP BY typname
ORDER BY typname;

-- 3. Kiểm tra dữ liệu hiện tại trong user_profiles
SELECT
    '=== DỮ LIỆU USER_PROFILES ===' as section,
    COUNT(*) as total_users
FROM user_profiles;

-- 4. Hiển thị sample data (5 users đầu tiên)
SELECT
    '=== SAMPLE DATA ===' as section,
    id,
    email,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role')
        THEN role::TEXT
        ELSE 'NO ROLE COLUMN'
    END as role_value,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role_backup')
        THEN role_backup
        ELSE 'NO BACKUP COLUMN'
    END as backup_value,
    created_at
FROM user_profiles
ORDER BY created_at
LIMIT 5;

-- 5. Kiểm tra RLS policies hiện tại
SELECT
    '=== RLS POLICIES ===' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('user_profiles', 'system_settings')
ORDER BY tablename, policyname;

-- 6. Kiểm tra RLS status
SELECT
    '=== RLS STATUS ===' as section,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('user_profiles', 'system_settings')
ORDER BY tablename;

SELECT '=== KIỂM TRA HOÀN TẤT ===' as final_info;