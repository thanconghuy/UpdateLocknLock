-- Check current database schema for projects table
-- Kiểm tra structure của projects table

-- 1. Check if projects table exists and its columns
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'projects'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if system_settings table exists and its columns
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'system_settings'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check current user and permissions
SELECT current_user, session_user;

-- 4. Try to query projects table (this will show RLS issues if any)
SELECT COUNT(*) as project_count FROM projects;

-- 5. Try to query system_settings table
SELECT COUNT(*) as settings_count FROM system_settings;

-- 6. Check RLS policies on projects table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'projects';

-- 7. Check RLS policies on system_settings table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'system_settings';