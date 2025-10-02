-- =====================================================
-- FIX: Correct role filter logic
-- =====================================================
-- Admin → Tất cả users
-- Manager → Manager, Editor, Viewer (KHÔNG Admin)
-- Editor → Editor, Viewer
-- Viewer → Viewer
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
  v_requesting_user_project_role VARCHAR;
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

  -- Get requesting user's project role
  SELECT pm.role INTO v_requesting_user_project_role
  FROM project_members pm
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_requesting_user_id
    AND pm.status = 'active';

  -- Permission check: Chỉ admin, owner, hoặc manager/admin trong project
  IF NOT (
    v_is_system_admin OR
    v_is_project_owner OR
    v_requesting_user_project_role IN ('admin', 'manager')
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot manage members of this project';
  END IF;

  -- Return users với filter theo role
  RETURN QUERY
  SELECT
    up.id AS user_id,
    up.email,
    up.full_name,
    up.role AS system_role,
    up.is_active
  FROM user_profiles up
  WHERE up.is_active = TRUE
    -- Chưa là member
    AND up.id NOT IN (
      SELECT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = p_project_id
    )
    -- Filter theo role
    AND (
      -- System Admin → Thấy tất cả
      v_is_system_admin
      OR
      -- Project Owner → Thấy tất cả
      v_is_project_owner
      OR
      -- Project Admin → Thấy tất cả
      (v_requesting_user_project_role = 'admin')
      OR
      -- Manager → Chỉ thấy Manager, Editor, Viewer (KHÔNG Admin)
      (v_requesting_user_project_role = 'manager' AND up.role IN ('manager', 'editor', 'viewer'))
      OR
      -- Editor → Chỉ thấy Editor, Viewer
      (v_requesting_user_project_role = 'editor' AND up.role IN ('editor', 'viewer'))
      OR
      -- Viewer → Chỉ thấy Viewer
      (v_requesting_user_project_role = 'viewer' AND up.role = 'viewer')
    )
  ORDER BY up.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_available_users_for_project TO authenticated;

SELECT '✅ Fixed: Correct role filter - Manager không thấy Admin' as status;
