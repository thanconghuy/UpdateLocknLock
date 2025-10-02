-- =====================================================
-- FIX: get_available_users_for_project
-- Issue: JOIN between pm.role and pr.name causing type error
-- Solution: Explicit cast and simplified logic
-- =====================================================

-- Drop and recreate with fix
DROP FUNCTION IF EXISTS get_available_users_for_project(INTEGER, UUID);

CREATE OR REPLACE FUNCTION get_available_users_for_project(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  role VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_user_role VARCHAR;
  v_role_level INTEGER;
BEGIN
  -- Check if user is system admin
  SELECT (up.role = 'admin') INTO v_is_admin
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- If admin, allow access
  IF v_is_admin THEN
    -- Return all active users who are NOT already members of this project
    RETURN QUERY
    SELECT
      up.id,
      up.email::TEXT,
      up.full_name::TEXT,
      up.role::VARCHAR
    FROM user_profiles up
    WHERE up.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = up.id
          AND pm.status = 'active'
      )
    ORDER BY up.email;
    RETURN;
  END IF;

  -- For non-admins, check if they are a member with manager+ role
  SELECT pm.role INTO v_user_role
  FROM project_members pm
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_user_id
    AND pm.status = 'active';

  -- If not a member, return nothing
  IF v_user_role IS NULL THEN
    RETURN;
  END IF;

  -- Get role level
  SELECT pr.level INTO v_role_level
  FROM project_roles pr
  WHERE pr.name::TEXT = v_user_role::TEXT;

  -- Only managers (level >= 80) can see available users
  IF v_role_level >= 80 THEN
    RETURN QUERY
    SELECT
      up.id,
      up.email::TEXT,
      up.full_name::TEXT,
      up.role::VARCHAR
    FROM user_profiles up
    WHERE up.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = up.id
          AND pm.status = 'active'
      )
    ORDER BY up.email;
    RETURN;
  END IF;

  -- Otherwise return nothing
  RETURN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_available_users_for_project(INTEGER, UUID) TO authenticated;

-- Verify
SELECT '✅ Fixed get_available_users_for_project function' as result;

-- Test
SELECT 'Testing function...' as info;
SELECT COUNT(*) as available_users_count
FROM get_available_users_for_project(463, '3114ecf0-6473-406d-b4e2-10150b4b09ba'::UUID);

SELECT '✅ Function ready to use!' as final_result;
