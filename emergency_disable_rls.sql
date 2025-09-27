-- ==========================================================================
-- EMERGENCY: DISABLE ALL RLS TO FIX INFINITE RECURSION
-- ==========================================================================
-- This will temporarily disable RLS completely to allow app to work
-- Run this in Supabase SQL Editor

-- 1. Disable RLS on all tables
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;

-- 2. Force drop ALL policies (even if they don't exist)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Enable read access for own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable update for own profile" ON user_profiles;
DROP POLICY IF EXISTS "Enable insert for own profile" ON user_profiles;

DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Project owners can manage projects" ON projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
DROP POLICY IF EXISTS "Project members can view projects" ON projects;
DROP POLICY IF EXISTS "Enable all access for project owners" ON projects;

DROP POLICY IF EXISTS "Users can view own membership" ON project_members;
DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;
DROP POLICY IF EXISTS "Project admins can view members" ON project_members;
DROP POLICY IF EXISTS "Admins can view all members" ON project_members;
DROP POLICY IF EXISTS "Admins can manage all members" ON project_members;
DROP POLICY IF EXISTS "Enable read for own membership" ON project_members;
DROP POLICY IF EXISTS "Enable all access for project owners" ON project_members;

-- 3. Verify RLS is disabled
SELECT
    'RLS STATUS CHECK:' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('user_profiles', 'projects', 'project_members');

-- 4. Test basic table access
SELECT 'TABLE ACCESS TEST:' as test_type, 'user_profiles' as table_name, count(*) as row_count FROM user_profiles
UNION ALL
SELECT 'TABLE ACCESS TEST', 'projects', count(*) FROM projects
UNION ALL
SELECT 'TABLE ACCESS TEST', 'project_members', count(*) FROM project_members;

-- Success message
SELECT '🎉 EMERGENCY FIX COMPLETE! RLS DISABLED. App should work now.' as status;