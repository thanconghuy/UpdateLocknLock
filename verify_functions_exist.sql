-- =====================================================
-- VERIFY: Check if all 6 functions exist
-- Run this BEFORE running comprehensive_fix_v3
-- =====================================================

-- Check if functions exist
SELECT
  proname as function_name,
  pg_get_function_identity_arguments(oid) as signature,
  CASE
    WHEN proname = 'get_project_members_for_user' THEN '✅ Function 1/6'
    WHEN proname = 'get_available_users_for_project' THEN '✅ Function 2/6'
    WHEN proname = 'get_user_project_permissions' THEN '✅ Function 3/6'
    WHEN proname = 'get_user_project_role' THEN '✅ Function 4/6'
    WHEN proname = 'can_user_manage_members' THEN '✅ Function 5/6'
    WHEN proname = 'add_project_member' THEN '✅ Function 6/6'
  END as status
FROM pg_proc
WHERE proname IN (
  'get_project_members_for_user',
  'get_available_users_for_project',
  'get_user_project_permissions',
  'get_user_project_role',
  'can_user_manage_members',
  'add_project_member'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- Count total functions
SELECT
  COUNT(*) as total_functions,
  CASE
    WHEN COUNT(*) = 0 THEN '❌ NO FUNCTIONS - Chạy comprehensive_fix_v3_no_notes.sql'
    WHEN COUNT(*) < 6 THEN '⚠️ THIẾU FUNCTIONS - Chạy comprehensive_fix_v3_no_notes.sql'
    WHEN COUNT(*) = 6 THEN '✅ ĐẦY ĐỦ 6 FUNCTIONS - Ready to use!'
    WHEN COUNT(*) > 6 THEN '⚠️ CÓ DUPLICATE - Chạy DROP script trước'
  END as status
FROM pg_proc
WHERE proname IN (
  'get_project_members_for_user',
  'get_available_users_for_project',
  'get_user_project_permissions',
  'get_user_project_role',
  'can_user_manage_members',
  'add_project_member'
)
AND pronamespace = 'public'::regnamespace;
