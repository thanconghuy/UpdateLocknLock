-- =====================================================
-- FIX: Permission logic FINAL - Chỉ Admin & Manager có quyền add members
-- =====================================================
-- Admin → Thấy tất cả, có quyền add members
-- Manager → Thấy Manager/Editor/Viewer, có quyền add members
-- Editor → KHÔNG có quyền add members (chỉ edit products)
-- Viewer → KHÔNG có quyền add members (chỉ xem)
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
  v_project_role_level INTEGER;
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

  -- Get requesting user's project role & level
  SELECT pm.role, pr.level
  INTO v_requesting_user_project_role, v_project_role_level
  FROM project_members pm
  JOIN project_roles pr ON pm.role = pr.name
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_requesting_user_id
    AND pm.status = 'active';

  -- Permission check: CHỈ Admin, Owner, hoặc Manager (level >= 80)
  IF NOT (
    v_is_system_admin OR
    v_is_project_owner OR
    (v_project_role_level IS NOT NULL AND v_project_role_level >= 80)
  ) THEN
    RAISE EXCEPTION 'Permission denied: Only Admin and Manager can add members';
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
      -- Project Admin (level 100) → Thấy tất cả
      (v_project_role_level = 100)
      OR
      -- Manager (level 80) → Chỉ thấy Manager, Editor, Viewer (KHÔNG Admin)
      (v_project_role_level = 80 AND up.role IN ('manager', 'editor', 'viewer'))
    )
  ORDER BY up.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_available_users_for_project TO authenticated;

SELECT '✅ FINAL: Only Admin & Manager can add members' as status;
