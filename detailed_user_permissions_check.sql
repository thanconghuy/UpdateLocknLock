-- ====================================
-- DETAILED USER PERMISSIONS CHECK
-- ====================================

-- 1. Kiểm tra thông tin user hiện tại
SELECT
    '=== CURRENT USER INFO ===' as section;

SELECT
    current_user as database_user,
    session_user,
    current_database() as database_name,
    current_schema() as current_schema,
    auth.uid() as supabase_auth_user_id;

-- 2. Kiểm tra user_profiles table permissions
SELECT
    '=== USER_PROFILES TABLE PERMISSIONS ===' as section;

SELECT
    grantee as "Granted To",
    privilege_type as "Permission",
    is_grantable as "Can Grant to Others",
    grantor as "Granted By"
FROM information_schema.role_table_grants
WHERE table_name = 'user_profiles'
ORDER BY grantee, privilege_type;

-- 3. Kiểm tra RLS policies
SELECT
    '=== ROW LEVEL SECURITY POLICIES ===' as section;

SELECT
    policyname as "Policy Name",
    permissive as "Type",
    roles as "Applies To Roles",
    cmd as "Command",
    qual as "USING Expression",
    with_check as "WITH CHECK Expression"
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 4. Kiểm tra RLS status
SELECT
    '=== RLS STATUS ===' as section;

SELECT
    schemaname,
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename = 'user_profiles';

-- 5. Test truy cập user_profiles
SELECT
    '=== ACCESS TEST ===' as section;

-- Test basic select
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM user_profiles LIMIT 1)
        THEN '✅ CAN READ user_profiles'
        ELSE '❌ CANNOT READ user_profiles'
    END as read_access;

-- Test count
SELECT
    CASE
        WHEN (SELECT COUNT(*) FROM user_profiles) >= 0
        THEN CONCAT('✅ CAN COUNT user_profiles: ', (SELECT COUNT(*) FROM user_profiles), ' records')
        ELSE '❌ CANNOT COUNT user_profiles'
    END as count_access;

-- 6. Kiểm tra user profile hiện tại
SELECT
    '=== CURRENT USER PROFILE ===' as section;

SELECT
    id,
    email,
    role,
    is_active,
    full_name,
    created_at,
    updated_at
FROM user_profiles
WHERE id = auth.uid()
LIMIT 1;

-- 7. Kiểm tra tất cả users (nếu có quyền admin)
SELECT
    '=== ALL USER PROFILES (Admin View) ===' as section;

SELECT
    id,
    email,
    role,
    is_active,
    full_name,
    created_at
FROM user_profiles
ORDER BY created_at DESC
LIMIT 10;

-- 8. Kiểm tra auth.users table (Supabase system table)
SELECT
    '=== SUPABASE AUTH USERS ===' as section;

SELECT
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data
FROM auth.users
WHERE id = auth.uid()
LIMIT 1;

-- 9. Kiểm tra các bảng khác user có quyền truy cập
SELECT
    '=== ALL ACCESSIBLE TABLES ===' as section;

SELECT DISTINCT
    table_schema as "Schema",
    table_name as "Table",
    string_agg(privilege_type, ', ') as "Permissions"
FROM information_schema.role_table_grants
WHERE grantee IN (current_user, 'authenticated', 'public')
    AND table_schema = 'public'
GROUP BY table_schema, table_name
ORDER BY table_schema, table_name;

-- 10. Kiểm tra system_settings table permissions (Admin Settings)
SELECT
    '=== SYSTEM_SETTINGS PERMISSIONS ===' as section;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM system_settings LIMIT 1)
        THEN '✅ CAN ACCESS system_settings'
        ELSE '❌ CANNOT ACCESS system_settings'
    END as system_settings_access;

-- Test admin access to system_settings
SELECT
    category,
    created_at,
    updated_at,
    created_by
FROM system_settings
ORDER BY updated_at DESC
LIMIT 5;

-- 11. Kiểm tra products table permissions
SELECT
    '=== PRODUCTS TABLE PERMISSIONS ===' as section;

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM products LIMIT 1)
        THEN CONCAT('✅ CAN ACCESS products: ', (SELECT COUNT(*) FROM products), ' records')
        ELSE '❌ CANNOT ACCESS products'
    END as products_access;

-- 12. Summary report
SELECT
    '=== PERMISSION SUMMARY ===' as section;

SELECT
    CASE
        WHEN auth.uid() IS NOT NULL THEN '✅ Authenticated'
        ELSE '❌ Not Authenticated'
    END as auth_status,

    CASE
        WHEN EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
        THEN '👑 ADMIN USER'
        WHEN EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid())
        THEN '👤 REGULAR USER'
        ELSE '❓ USER NOT FOUND'
    END as user_type,

    CASE
        WHEN EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_active = true)
        THEN '✅ Active'
        ELSE '❌ Inactive'
    END as account_status;