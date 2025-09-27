-- Debug admin loading issues

-- 1. Check system_settings table existence and access
SELECT 'system_settings table check:' as info;

SELECT
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings')
    THEN 'EXISTS' ELSE 'MISSING' END as table_exists;

-- 2. Test direct access to system_settings
SELECT 'Direct system_settings access:' as info;
SELECT COUNT(*) as record_count FROM system_settings;

-- 3. Check RLS status for system_settings
SELECT 'RLS status for system_settings:' as info;
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'system_settings';

-- 4. List all RLS policies on system_settings
SELECT 'RLS policies on system_settings:' as info, '' as policy_name;
SELECT '', policyname
FROM pg_policies
WHERE tablename = 'system_settings';

-- 5. Test insert to system_settings
INSERT INTO system_settings (category, config_data, created_at, updated_at)
VALUES ('test', 'test-data', NOW(), NOW())
ON CONFLICT (category) DO UPDATE SET
    config_data = 'test-data-updated',
    updated_at = NOW();

-- 6. Test upsert (like WooCommerce config save)
INSERT INTO system_settings (category, config_data, updated_at)
VALUES ('woocommerce-test', 'test-encrypted-data', NOW())
ON CONFLICT (category) DO UPDATE SET
    config_data = 'test-encrypted-data',
    updated_at = NOW();

-- 7. Show current records
SELECT 'Current system_settings records:' as info, '' as category, '' as created_at;
SELECT '', category, created_at::text FROM system_settings ORDER BY created_at DESC;

-- 8. Test user_profiles access (check if this is working now)
SELECT 'user_profiles access test:' as info;
SELECT COUNT(*) as user_count FROM user_profiles;

-- 9. Check current user's admin status
SELECT 'Current user admin check:' as info, '' as user_id, '' as role;
SELECT '', id::text, role::text FROM user_profiles WHERE id = auth.uid();

SELECT 'Debug completed' as status;