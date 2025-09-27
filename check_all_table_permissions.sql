-- ====================================
-- CHECK ALL TABLE PERMISSIONS
-- ====================================

-- Function to test table access
CREATE OR REPLACE FUNCTION test_table_access(table_name text)
RETURNS text AS $$
DECLARE
    result text;
    record_count integer;
BEGIN
    BEGIN
        EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO record_count;
        result := format('✅ %s: %s records', table_name, record_count);
    EXCEPTION
        WHEN insufficient_privilege THEN
            result := format('❌ %s: No access (insufficient privilege)', table_name);
        WHEN undefined_table THEN
            result := format('⚠️ %s: Table does not exist', table_name);
        WHEN OTHERS THEN
            result := format('❓ %s: Error - %s', table_name, SQLERRM);
    END;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Test access to all important tables
SELECT
    '=== TABLE ACCESS TESTS ===' as section;

SELECT test_table_access('user_profiles') as access_test
UNION ALL
SELECT test_table_access('system_settings')
UNION ALL
SELECT test_table_access('products')
UNION ALL
SELECT test_table_access('product_updates')
UNION ALL
SELECT test_table_access('projects')
UNION ALL
SELECT test_table_access('auth.users');

-- Detailed permissions for each table
SELECT
    '=== DETAILED TABLE PERMISSIONS ===' as section;

WITH important_tables AS (
    SELECT unnest(ARRAY['user_profiles', 'system_settings', 'products', 'product_updates', 'projects']) as table_name
)
SELECT
    it.table_name as "Table",
    COALESCE(
        string_agg(
            rtg.privilege_type || ' (' || rtg.grantee || ')',
            ', '
            ORDER BY rtg.privilege_type
        ),
        'No permissions found'
    ) as "Permissions"
FROM important_tables it
LEFT JOIN information_schema.role_table_grants rtg
    ON it.table_name = rtg.table_name
    AND rtg.grantee IN (current_user, 'authenticated', 'public')
GROUP BY it.table_name
ORDER BY it.table_name;

-- RLS Status for all tables
SELECT
    '=== RLS STATUS ALL TABLES ===' as section;

SELECT
    schemaname,
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename IN ('user_profiles', 'system_settings', 'products', 'product_updates', 'projects')
ORDER BY tablename;

-- All RLS Policies
SELECT
    '=== ALL RLS POLICIES ===' as section;

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename IN ('user_profiles', 'system_settings', 'products', 'product_updates', 'projects')
ORDER BY tablename, policyname;

-- Current user's role and permissions
SELECT
    '=== CURRENT USER ROLE & PERMISSIONS ===' as section;

SELECT
    up.email,
    up.role,
    up.is_active,
    up.created_at,
    CASE
        WHEN up.role = 'admin' THEN '👑 Full Admin Access'
        WHEN up.role = 'user' THEN '👤 Regular User Access'
        ELSE '❓ Unknown Role'
    END as permission_level
FROM user_profiles up
WHERE up.id = auth.uid();

-- Clean up function
DROP FUNCTION test_table_access(text);