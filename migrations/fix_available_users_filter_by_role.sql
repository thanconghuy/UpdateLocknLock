-- =====================================================
-- FIX: Filter available users by requesting user's role
-- =====================================================
-- Manager không nên thấy System Admin trong dropdown
-- =====================================================

CREATE OR REPLACE FUNCTION get_available_users_for_project(
  p_project_id INTEGER,
  p_requesting_user_id UUID
)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  full_name VARCHAR,
  system_role VARCHAR,
  is_active BOOLEAN
) AS $$
DECLARE
  v_requesting_user_system_role VARCHAR;
  v_requesting_user_project_level INTEGER;
  v_is_system_admin BOOLEAN;
  v_is_project_owner BOOLEAN;
BEGIN
  -- Get requesting user's system role
  SELECT role INTO v_requesting_user_system_role
  FROM user_profiles
  WHERE id = p_requesting_user_id;

  -- Check if system admin
  v_is_system_admin := (v_requesting_user_system_role = 'admin');

  -- Check if project owner
  SELECT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.project_id = p_project_id AND p.owner_id = p_requesting_user_id
  ) INTO v_is_project_owner;

  -- Get requesting user's project role level
  SELECT pr.level INTO v_requesting_user_project_level
  FROM project_members pm
  JOIN project_roles pr ON pm.role = pr.name
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_requesting_user_id
    AND pm.status = 'active';

  -- Permission check
  IF NOT (
    v_is_system_admin OR
    v_is_project_owner OR
    (v_requesting_user_project_level IS NOT NULL AND v_requesting_user_project_level >= 80)
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot manage members of this project';
  END IF;

  -- Return users chưa là member + FILTER by role level
  RETURN QUERY
  SELECT
    up.id AS user_id,
    up.email,
    up.full_name,
    up.role AS system_role,
    up.is_active
  FROM user_profiles up
  WHERE up.is_active = TRUE
    -- Not already a member
    AND up.id NOT IN (
      SELECT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = p_project_id
    )
    -- Filter by role level
    AND (
      -- System Admin hoặc Project Owner → Thấy tất cả
      v_is_system_admin OR v_is_project_owner
      OR
      -- Manager (không phải system admin/owner) → Không thấy Admin
      (
        v_requesting_user_project_level = 80 AND -- Manager level
        NOT v_is_system_admin AND
        NOT v_is_project_owner AND
        up.role != 'admin' -- Hide system admins
      )
      OR
      -- Editor → Chỉ thấy Editor, Viewer
      (
        v_requesting_user_project_level = 60 AND
        up.role IN ('editor', 'viewer')
      )
      OR
      -- Viewer → Chỉ thấy Viewer
      (
        v_requesting_user_project_level = 40 AND
        up.role = 'viewer'
      )
    )
  ORDER BY up.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_available_users_for_project TO authenticated;

SELECT '✅ Fixed: get_available_users_for_project now filters by role level' as status;
