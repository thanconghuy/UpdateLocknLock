-- Debug current database state

-- 1. Check all tables in public schema
SELECT 'Current tables in public schema:' as info, '' as table_name;
SELECT '', table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 2. Check specific tables we need
SELECT 'Table existence check:' as info, '' as table_name, '' as exists;
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
) AS t(table_name);

-- 3. Check columns for existing tables
DO $$
DECLARE
    tbl_name TEXT;
BEGIN
    FOR tbl_name IN
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('products', 'product_updates', 'system_settings', 'projects')
    LOOP
        RAISE NOTICE 'Table: %', tbl_name;

        -- Show columns for this table
        FOR rec IN
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = tbl_name
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  Column: % (type: %)', rec.column_name, rec.data_type;
        END LOOP;
    END LOOP;
END $$;

-- 4. Check current user and auth status
SELECT 'Current auth info:' as info, '' as detail, '' as value;
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

-- 5. Check RLS policies
SELECT 'RLS policies:' as info, '' as table_name, '' as policy_name;
SELECT
    '',
    schemaname || '.' || tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;