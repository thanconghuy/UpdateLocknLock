-- Ultra simple debug - no complex queries

-- 1. Check what tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Check if specific tables exist
SELECT
    'projects' as table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects')
         THEN 'EXISTS' ELSE 'MISSING' END as status
UNION ALL
SELECT
    'user_profiles',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles')
         THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT
    'products',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products')
         THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT
    'product_updates',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'product_updates')
         THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT
    'system_settings',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings')
         THEN 'EXISTS' ELSE 'MISSING' END;

-- 3. Check auth status
SELECT
    'User ID' as detail,
    COALESCE(auth.uid()::text, 'Not authenticated') as value
UNION ALL
SELECT
    'User role',
    COALESCE(auth.role()::text, 'No role')
UNION ALL
SELECT
    'Total auth.users',
    COUNT(*)::text
FROM auth.users;

-- 4. If projects table exists, show its structure
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
ORDER BY column_name;