-- =====================================================
-- FORCE GRANT PERMISSIONS
-- Re-grant để trigger PostgREST schema refresh
-- =====================================================

-- Revoke first (to force change detection)
REVOKE ALL ON FUNCTION get_user_project_role(INTEGER, UUID) FROM authenticated;
REVOKE ALL ON FUNCTION get_user_project_permissions(INTEGER, UUID) FROM authenticated;
REVOKE ALL ON FUNCTION can_user_manage_members(INTEGER, UUID) FROM authenticated;
REVOKE ALL ON FUNCTION get_project_members_for_user(INTEGER, UUID) FROM authenticated;
REVOKE ALL ON FUNCTION get_available_users_for_project(INTEGER, UUID) FROM authenticated;
REVOKE ALL ON FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB) FROM authenticated;

-- Grant again
GRANT EXECUTE ON FUNCTION get_user_project_role(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_project_permissions(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_manage_members(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_project_members_for_user(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_users_for_project(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB) TO authenticated;

-- Also grant to anon (for unauthenticated calls if needed)
GRANT EXECUTE ON FUNCTION get_user_project_role(INTEGER, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_user_project_permissions(INTEGER, UUID) TO anon;
GRANT EXECUTE ON FUNCTION can_user_manage_members(INTEGER, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_project_members_for_user(INTEGER, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_available_users_for_project(INTEGER, UUID) TO anon;
GRANT EXECUTE ON FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB) TO anon;

SELECT '✅ Permissions re-granted' as result;
SELECT 'Wait 30 seconds, then refresh browser and test' as action;
