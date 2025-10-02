-- =====================================================
-- FIX: Ambiguous column reference "project_id"
-- =====================================================

-- Function 2: Get Available Users for Project (FIXED)
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
BEGIN
  -- Permission check: Chỉ admin hoặc manager mới xem
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner (⚠️ FIX: Thêm alias p.)
    EXISTS (SELECT 1 FROM projects p WHERE p.project_id = p_project_id AND p.owner_id = p_requesting_user_id)
    OR
    -- Project admin/manager (level >= 80)
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN project_roles pr ON pm.role = pr.name
      WHERE pm.project_id = p_project_id
        AND pm.user_id = p_requesting_user_id
        AND pm.status = 'active'
        AND pr.level >= 80
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot manage members of this project';
  END IF;

  -- Return users chưa là member
  RETURN QUERY
  SELECT
    up.id AS user_id,
    up.email,
    up.full_name,
    up.role AS system_role,
    up.is_active
  FROM user_profiles up
  WHERE up.is_active = TRUE
    AND up.id NOT IN (
      SELECT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.status = 'active'
    )
  ORDER BY up.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_available_users_for_project TO authenticated;

SELECT '✅ Fixed: get_available_users_for_project (ambiguous project_id)' as status;
