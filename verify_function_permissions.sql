-- =====================================================
-- VERIFY FUNCTION PERMISSIONS
-- Check if authenticated role has EXECUTE permission
-- =====================================================

-- Check function permissions
SELECT
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as signature,
  CASE
    WHEN p.prosecdef THEN 'SECURITY DEFINER ✅'
    ELSE 'SECURITY INVOKER ⚠️'
  END as security_type,
  pg_catalog.pg_get_userbyid(p.proowner) as owner,
  (
    SELECT string_agg(rolname, ', ')
    FROM pg_roles r
    WHERE has_function_privilege(r.oid, p.oid, 'EXECUTE')
      AND rolname IN ('authenticated', 'anon', 'public')
  ) as has_execute_permission
FROM pg_proc p
WHERE p.proname IN (
  'get_user_project_role',
  'get_user_project_permissions',
  'can_user_manage_members',
  'get_project_members_for_user',
  'get_available_users_for_project',
  'add_project_member'
)
AND p.pronamespace = 'public'::regnamespace
ORDER BY p.proname;

-- Check if 'authenticated' role can execute
SELECT
  proname,
  CASE
    WHEN has_function_privilege('authenticated', oid, 'EXECUTE') THEN '✅ YES'
    ELSE '❌ NO - Missing GRANT!'
  END as can_authenticated_execute
FROM pg_proc
WHERE proname IN (
  'get_user_project_role',
  'get_user_project_permissions',
  'can_user_manage_members'
)
AND pronamespace = 'public'::regnamespace;
