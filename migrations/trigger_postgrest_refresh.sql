-- =====================================================
-- TRIGGER POSTGREST SCHEMA REFRESH
-- Force PostgREST to detect new functions
-- =====================================================

-- Step 1: Add comments to trigger change detection
COMMENT ON FUNCTION get_user_project_role(INTEGER, UUID)
IS 'Get user role in project - Updated 2025-10-01';

COMMENT ON FUNCTION get_user_project_permissions(INTEGER, UUID)
IS 'Get user permissions in project - Updated 2025-10-01';

COMMENT ON FUNCTION can_user_manage_members(INTEGER, UUID)
IS 'Check if user can manage members - Updated 2025-10-01';

COMMENT ON FUNCTION get_project_members_for_user(INTEGER, UUID)
IS 'Get project members for user - Updated 2025-10-01';

COMMENT ON FUNCTION get_available_users_for_project(INTEGER, UUID)
IS 'Get available users for project - Updated 2025-10-01';

COMMENT ON FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB)
IS 'Add member to project - Updated 2025-10-01';

-- Step 2: Re-grant permissions (triggers another event)
REVOKE ALL ON FUNCTION get_user_project_role(INTEGER, UUID) FROM authenticated, anon CASCADE;
REVOKE ALL ON FUNCTION get_user_project_permissions(INTEGER, UUID) FROM authenticated, anon CASCADE;
REVOKE ALL ON FUNCTION can_user_manage_members(INTEGER, UUID) FROM authenticated, anon CASCADE;
REVOKE ALL ON FUNCTION get_project_members_for_user(INTEGER, UUID) FROM authenticated, anon CASCADE;
REVOKE ALL ON FUNCTION get_available_users_for_project(INTEGER, UUID) FROM authenticated, anon CASCADE;
REVOKE ALL ON FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB) FROM authenticated, anon CASCADE;

-- Grant back
GRANT EXECUTE ON FUNCTION get_user_project_role(INTEGER, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_user_project_permissions(INTEGER, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION can_user_manage_members(INTEGER, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_project_members_for_user(INTEGER, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_available_users_for_project(INTEGER, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB) TO authenticated, anon;

-- Step 3: Verify permissions
SELECT
  proname as function_name,
  has_function_privilege('authenticated', oid, 'EXECUTE') as can_execute,
  obj_description(oid, 'pg_proc') as comment
FROM pg_proc
WHERE proname IN (
  'get_user_project_role',
  'get_user_project_permissions',
  'can_user_manage_members'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

SELECT '✅ PostgREST schema refresh triggered' as result
UNION ALL
SELECT '⏳ Wait 30-60 seconds for changes to propagate' as result
UNION ALL
SELECT '🔄 Then refresh browser (Ctrl+Shift+R) and test' as result;
