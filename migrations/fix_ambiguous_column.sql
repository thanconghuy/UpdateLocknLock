-- =====================================================
-- FIX: Ambiguous column 'role' in get_project_members_for_user
-- =====================================================

CREATE OR REPLACE FUNCTION get_project_members_for_user(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS TABLE (
  id UUID,
  project_id INTEGER,
  user_id UUID,
  role VARCHAR,
  status VARCHAR,
  invited_by UUID,
  assigned_at TIMESTAMP,
  updated_at TIMESTAMP,
  permissions JSONB,
  notes TEXT,
  created_at TIMESTAMP,
  user_email TEXT,
  user_full_name TEXT,
  user_system_role VARCHAR,
  user_is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is system admin
  SELECT (up.role = 'admin') INTO v_is_admin
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- Admins see all members
  IF v_is_admin THEN
    RETURN QUERY
    SELECT
      pm.id,
      pm.project_id,
      pm.user_id,
      pm.role::VARCHAR,              -- Explicitly use pm.role for project role
      pm.status::VARCHAR,
      pm.invited_by,
      pm.assigned_at,
      pm.updated_at,
      pm.permissions,
      pm.notes,
      pm.created_at,
      up.email::TEXT,
      up.full_name::TEXT,
      up.role::VARCHAR,              -- up.role for system role
      up.is_active
    FROM project_members pm
    JOIN user_profiles up ON pm.user_id = up.id
    WHERE pm.project_id = p_project_id
      AND pm.status = 'active'
    ORDER BY pm.assigned_at DESC;
    RETURN;
  END IF;

  -- Non-admins: check if they are a member of this project
  IF EXISTS (
    SELECT 1 FROM project_members pm2
    WHERE pm2.project_id = p_project_id
      AND pm2.user_id = p_user_id
      AND pm2.status = 'active'
  ) THEN
    RETURN QUERY
    SELECT
      pm.id,
      pm.project_id,
      pm.user_id,
      pm.role::VARCHAR,
      pm.status::VARCHAR,
      pm.invited_by,
      pm.assigned_at,
      pm.updated_at,
      pm.permissions,
      pm.notes,
      pm.created_at,
      up.email::TEXT,
      up.full_name::TEXT,
      up.role::VARCHAR,
      up.is_active
    FROM project_members pm
    JOIN user_profiles up ON pm.user_id = up.id
    WHERE pm.project_id = p_project_id
      AND pm.status = 'active'
    ORDER BY pm.assigned_at DESC;
    RETURN;
  END IF;

  -- User is not a member, return empty
  RETURN;
END;
$$;

SELECT '✅ Fixed ambiguous column reference in get_project_members_for_user' as result;
