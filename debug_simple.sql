-- Simple debug current database state

-- 1. Check all tables in public schema
SELECT 'Current tables in public schema:' as info, '' as table_name
UNION ALL
SELECT '', table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY info DESC, table_name;

-- 2. Check specific tables we need
SELECT 'Table existence check:' as info, '' as table_name, '' as exists
UNION ALL
SELECT
    '',
    t.table_name,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = t.table_name
    ) THEN 'EXISTS' ELSE 'MISSING' END as exists
FROM (
    VALUES
    ('products'),
    ('product_updates'),
    ('system_settings'),
    ('projects'),
    ('user_profiles')
) AS t(table_name)
ORDER BY info DESC, table_name;

-- 3. Check projects table columns if it exists
SELECT 'Projects table columns:' as info, '' as column_name, '' as data_type
UNION ALL
SELECT
    '',
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
ORDER BY info DESC, ordinal_position;

-- 4. Check user_profiles table columns if it exists
SELECT 'User_profiles table columns:' as info, '' as column_name, '' as data_type
UNION ALL
SELECT
    '',
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
ORDER BY info DESC, ordinal_position;

-- 5. Check current user and auth status
SELECT 'Current auth info:' as info, '' as detail, '' as value
UNION ALL
SELECT
    '',
    'User ID',
    COALESCE(auth.uid()::text, 'Not authenticated')
UNION ALL
SELECT
    '',
    'User role',
    COALESCE(auth.role()::text, 'No role')
UNION ALL
SELECT
    '',
    'User email',
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), 'No email');

-- 6. Count records in key tables
SELECT 'Record counts:' as info, '' as table_name, '' as count
UNION ALL
SELECT '', 'auth.users', COUNT(*)::text FROM auth.users
UNION ALL
SELECT '', 'user_profiles',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles')
    THEN (SELECT COUNT(*)::text FROM user_profiles)
    ELSE 'Table not found'
    END
UNION ALL
SELECT '', 'projects',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects')
    THEN (SELECT COUNT(*)::text FROM projects)
    ELSE 'Table not found'
    END;