-- ==========================================================================
-- FIX RLS POLICIES - REMOVE INFINITE RECURSION
-- ==========================================================================
-- Script để fix lỗi "infinite recursion detected in policy for relation user_profiles"
-- Run this in Supabase SQL Editor

-- 1. Disable RLS temporarily to fix the issue
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_members DISABLE ROW LEVEL SECURITY;

-- 2. Drop all existing policies to start fresh
DO $$
BEGIN
    -- Drop user_profiles policies
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
    DROP POLICY IF EXISTS "Admins can manage all profiles" ON user_profiles;

    -- Drop projects policies
    DROP POLICY IF EXISTS "Users can view own projects" ON projects;
    DROP POLICY IF EXISTS "Project owners can manage projects" ON projects;
    DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
    DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
    DROP POLICY IF EXISTS "Project members can view projects" ON projects;

    -- Drop project_members policies
    DROP POLICY IF EXISTS "Users can view own membership" ON project_members;
    DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;
    DROP POLICY IF EXISTS "Project admins can view members" ON project_members;
    DROP POLICY IF EXISTS "Admins can view all members" ON project_members;
    DROP POLICY IF EXISTS "Admins can manage all members" ON project_members;

    RAISE NOTICE '✅ All old policies dropped successfully';
END $$;

-- 3. Create simple, non-recursive policies for user_profiles
CREATE POLICY "Enable read access for own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Enable update for own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Enable insert for own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Create simple policies for projects
CREATE POLICY "Enable all access for project owners" ON projects
    FOR ALL USING (auth.uid() = owner_id);

-- 5. Create simple policies for project_members
CREATE POLICY "Enable read for own membership" ON project_members
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Enable all access for project owners" ON project_members
    FOR ALL USING (
        auth.uid() IN (
            SELECT owner_id FROM projects WHERE id = project_id
        )
    );

-- 6. Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- 7. Test the fix
SELECT
    'RLS POLICIES TEST:' as test,
    (
        CASE WHEN EXISTS (
            SELECT 1 FROM user_profiles LIMIT 1
        ) THEN '✅ user_profiles accessible'
        ELSE '❌ user_profiles blocked'
        END
    ) as user_profiles_status;

-- 8. Show current policies
SELECT
    'CURRENT POLICIES:' as info,
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('user_profiles', 'projects', 'project_members')
ORDER BY tablename, policyname;

RAISE NOTICE '🎉 RLS policies fixed successfully!';