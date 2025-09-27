-- Debug database structure for project creation error

-- 1. Check if tables exist
SELECT 'Table exists check:' as info, '' as table_name, '' as exists
UNION ALL
SELECT '', table_name, 'YES' as exists
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('projects', 'project_members', 'user_profiles', 'system_settings')
ORDER BY table_name;

-- 2. Check projects table structure
SELECT 'Projects table columns:' as info, '' as column_name, '' as data_type
UNION ALL
SELECT '', column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
ORDER BY ordinal_position;

-- 3. Check project_members table if exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_members') THEN
        RAISE NOTICE 'project_members table exists, checking structure...';
    ELSE
        RAISE NOTICE 'project_members table MISSING!';
    END IF;
END $$;

-- 4. Check user_profiles table structure
SELECT 'User_profiles table columns:' as info, '' as column_name, '' as data_type
UNION ALL
SELECT '', column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 5. Check current user
SELECT
    'Current user info:' as info,
    auth.uid()::text as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as email;

-- 6. Check user_profiles record for current user
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid()) THEN
        RAISE NOTICE 'User profile exists for current user';
    ELSE
        RAISE NOTICE 'User profile MISSING for current user!';
    END IF;
END $$;

-- 7. Try a simple projects query
SELECT 'Simple projects query test:' as info;
SELECT COUNT(*) as project_count FROM projects WHERE is_active = true;