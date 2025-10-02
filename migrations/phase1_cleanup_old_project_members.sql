-- =====================================================
-- PHASE 1: CLEAN UP OLD PROJECT MEMBERS SYSTEM
-- Date: 2025-10-02
-- Description: Drop tất cả functions, policies cũ
-- =====================================================

-- Step 1: Drop all RLS Policies
DO $$
BEGIN
  -- Drop policies on project_members
  DROP POLICY IF EXISTS "Users see members of their projects" ON project_members;
  DROP POLICY IF EXISTS "Users see members of their projects or admins see all" ON project_members;
  DROP POLICY IF EXISTS "Admins and project managers can add members" ON project_members;
  DROP POLICY IF EXISTS "Admins and project managers can update members" ON project_members;
  DROP POLICY IF EXISTS "Admins and project admins can delete members" ON project_members;
  DROP POLICY IF EXISTS "system_admins_full_access" ON project_members;

  -- Drop policies on project_roles
  DROP POLICY IF EXISTS "Authenticated users can view roles" ON project_roles;
  DROP POLICY IF EXISTS "authenticated_users_can_view_roles" ON project_roles;

  RAISE NOTICE '✅ Dropped all RLS policies';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Warning: Some policies may not exist - %', SQLERRM;
END $$;

-- Step 2: Drop all Functions (với CASCADE để xóa dependencies)
DO $$
BEGIN
  DROP FUNCTION IF EXISTS get_project_members CASCADE;
  DROP FUNCTION IF EXISTS get_project_members_for_user CASCADE;
  DROP FUNCTION IF EXISTS get_available_users_for_project CASCADE;
  DROP FUNCTION IF EXISTS add_project_member CASCADE;
  DROP FUNCTION IF EXISTS update_project_member_role CASCADE;
  DROP FUNCTION IF EXISTS remove_project_member CASCADE;
  DROP FUNCTION IF EXISTS can_user_manage_members CASCADE;
  DROP FUNCTION IF EXISTS get_user_project_role CASCADE;
  DROP FUNCTION IF EXISTS get_user_project_permissions CASCADE;
  DROP FUNCTION IF EXISTS get_project_member_count CASCADE;
  DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

  RAISE NOTICE '✅ Dropped all old functions';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Warning: Some functions may not exist - %', SQLERRM;
END $$;

-- Step 3: Drop project_members table (CASCADE để xóa tất cả dependencies)
DO $$
BEGIN
  DROP TABLE IF EXISTS project_members CASCADE;
  RAISE NOTICE '✅ Dropped project_members table';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Warning: project_members table may not exist - %', SQLERRM;
END $$;

-- Step 4: Drop project_roles table (CASCADE)
DO $$
BEGIN
  DROP TABLE IF EXISTS project_roles CASCADE;
  RAISE NOTICE '✅ Dropped project_roles table';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Warning: project_roles table may not exist - %', SQLERRM;
END $$;

-- Step 5: Verification - Check nothing left
SELECT '=== VERIFICATION ===' as status;

-- Check functions
SELECT
  '❌ FOUND OLD FUNCTIONS:' as warning,
  proname as function_name
FROM pg_proc
WHERE proname IN (
  'get_project_members',
  'get_project_members_for_user',
  'get_available_users_for_project',
  'add_project_member',
  'update_project_member_role',
  'remove_project_member',
  'can_user_manage_members',
  'get_user_project_role',
  'get_user_project_permissions',
  'get_project_member_count'
);

-- Check tables
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_members')
    THEN '❌ project_members table still exists'
    ELSE '✅ project_members table dropped'
  END as project_members_status;

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_roles')
    THEN '❌ project_roles table still exists'
    ELSE '✅ project_roles table dropped'
  END as project_roles_status;

-- Final message
SELECT '✅ PHASE 1 CLEANUP COMPLETED!' as status;
SELECT 'All old project members system code has been removed.' as message;
SELECT 'Ready for Phase 2: Create new clean schema' as next_step;
