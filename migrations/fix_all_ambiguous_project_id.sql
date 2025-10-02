-- =====================================================
-- FIX: Ambiguous column reference "project_id"
-- Fix CẢ 2 FUNCTIONS
-- =====================================================

-- =====================================================
-- Function 1: Get Project Members (FIXED)
-- =====================================================
CREATE OR REPLACE FUNCTION get_project_members(
  p_project_id INTEGER,
  p_requesting_user_id UUID
)
RETURNS TABLE (
  member_id UUID,
  project_id INTEGER,
  user_id UUID,
  user_email VARCHAR,
  user_full_name VARCHAR,
  user_system_role VARCHAR,
  project_role VARCHAR,
  status VARCHAR,
  permissions JSONB,
  created_at TIMESTAMPTZ,
  invited_by UUID
) AS $$
BEGIN
  -- Permission check
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner (⚠️ FIX: Thêm alias p.)
    EXISTS (SELECT 1 FROM projects p WHERE p.project_id = p_project_id AND p.owner_id = p_requesting_user_id)
    OR
    -- Project member (⚠️ FIX: Thêm alias pm2.)
    EXISTS (SELECT 1 FROM project_members pm2 WHERE pm2.project_id = p_project_id AND pm2.user_id = p_requesting_user_id AND pm2.status = 'active')
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot view members of this project';
  END IF;

  -- Return members với JOIN
  RETURN QUERY
  SELECT
    pm.id AS member_id,
    pm.project_id,
    pm.user_id,
    up.email AS user_email,
    up.full_name AS user_full_name,
    up.role AS user_system_role,
    pm.role AS project_role,
    pm.status,
    COALESCE(
      pm.permissions,
      (SELECT default_permissions FROM project_roles WHERE name = pm.role)
    ) AS permissions,
    pm.created_at,
    pm.invited_by
  FROM project_members pm
  JOIN user_profiles up ON pm.user_id = up.id
  WHERE pm.project_id = p_project_id
    AND pm.status = 'active'
  ORDER BY pm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_project_members TO authenticated;

SELECT '✅ Fixed: get_project_members (ambiguous project_id)' as status;

-- =====================================================
-- Function 2: Get Available Users for Project (FIXED)
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

-- =====================================================
-- DONE
-- =====================================================
SELECT '🎉 All functions fixed successfully!' as final_status;
