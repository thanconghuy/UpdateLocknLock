-- =====================================================
-- CLEANUP: Remove all duplicate/old functions
-- Then recreate with correct signatures
-- =====================================================

-- Drop ALL versions of these functions (with all possible signatures)
DROP FUNCTION IF EXISTS get_user_project_role(INTEGER, UUID);
DROP FUNCTION IF EXISTS get_user_project_role(UUID, UUID);
DROP FUNCTION IF EXISTS get_user_project_role(VARCHAR, UUID);
DROP FUNCTION IF EXISTS get_user_project_role(TEXT, UUID);

DROP FUNCTION IF EXISTS get_user_project_permissions(INTEGER, UUID);
DROP FUNCTION IF EXISTS get_user_project_permissions(UUID, UUID);
DROP FUNCTION IF EXISTS get_user_project_permissions(VARCHAR, UUID);
DROP FUNCTION IF EXISTS get_user_project_permissions(TEXT, UUID);

DROP FUNCTION IF EXISTS can_user_manage_members(INTEGER, UUID);
DROP FUNCTION IF EXISTS can_user_manage_members(UUID, UUID);
DROP FUNCTION IF EXISTS can_user_manage_members(VARCHAR, UUID);
DROP FUNCTION IF EXISTS can_user_manage_members(TEXT, UUID);

DROP FUNCTION IF EXISTS get_project_member_count(INTEGER);
DROP FUNCTION IF EXISTS get_project_member_count(UUID);
DROP FUNCTION IF EXISTS get_project_member_count(VARCHAR);
DROP FUNCTION IF EXISTS get_project_member_count(TEXT);

DROP FUNCTION IF EXISTS get_project_members_for_user(INTEGER, UUID);
DROP FUNCTION IF EXISTS get_project_members_for_user(UUID, UUID);

DROP FUNCTION IF EXISTS add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB);
DROP FUNCTION IF EXISTS add_project_member(UUID, UUID, VARCHAR, UUID, JSONB);

-- =====================================================
-- RECREATE FUNCTIONS with explicit signatures
-- =====================================================

-- Function 1: Get user's role in a project
CREATE FUNCTION get_user_project_role(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if system admin first
  SELECT (role = 'admin') INTO v_is_admin
  FROM user_profiles
  WHERE id = p_user_id;

  -- System admins have 'admin' role in all projects
  IF v_is_admin THEN
    RETURN 'admin';
  END IF;

  -- Get project-specific role
  SELECT role INTO v_role
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND status = 'active';

  -- Return role or 'none' if not a member
  RETURN COALESCE(v_role, 'none');
END;
$$;

-- Function 2: Get user's permissions in a project
CREATE FUNCTION get_user_project_permissions(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR;
  v_default_permissions JSONB;
  v_custom_permissions JSONB;
  v_final_permissions JSONB;
BEGIN
  -- Get user's role
  v_role := get_user_project_role(p_project_id, p_user_id);

  -- If no role, return all false
  IF v_role = 'none' THEN
    RETURN '{"can_manage_members": false, "can_edit_project": false, "can_delete_project": false, "can_manage_woocommerce": false, "can_edit_products": false, "can_view_analytics": false}'::JSONB;
  END IF;

  -- Get default permissions from role definition
  SELECT default_permissions INTO v_default_permissions
  FROM project_roles
  WHERE name = v_role;

  -- Get custom permissions from project_members (if any)
  SELECT COALESCE(permissions, '{}'::JSONB) INTO v_custom_permissions
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND status = 'active';

  -- Merge: custom permissions override default permissions
  v_final_permissions := v_default_permissions || COALESCE(v_custom_permissions, '{}'::JSONB);

  RETURN v_final_permissions;
END;
$$;

-- Function 3: Check if user can manage members
CREATE FUNCTION can_user_manage_members(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_system_admin BOOLEAN;
  v_project_role VARCHAR;
BEGIN
  -- Check if system admin
  SELECT (role = 'admin') INTO v_is_system_admin
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_is_system_admin THEN
    RETURN TRUE;
  END IF;

  -- Check project role (SECURITY DEFINER bypasses RLS)
  SELECT role INTO v_project_role
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND status = 'active';

  -- Admin and manager roles can manage members
  RETURN v_project_role IN ('admin', 'manager');
END;
$$;

-- Function 4: Get member count
CREATE FUNCTION get_project_member_count(
  p_project_id INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM project_members
    WHERE project_id = p_project_id
      AND status = 'active'
  );
END;
$$;

-- Function 5: Get project members for user
CREATE FUNCTION get_project_members_for_user(
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
  SELECT (role = 'admin') INTO v_is_admin
  FROM user_profiles
  WHERE id = p_user_id;

  -- Admins see all members
  IF v_is_admin THEN
    RETURN QUERY
    SELECT
      pm.id,
      pm.project_id,
      pm.user_id,
      pm.role,
      pm.status,
      pm.invited_by,
      pm.assigned_at,
      pm.updated_at,
      pm.permissions,
      pm.notes,
      pm.created_at,
      up.email::TEXT as user_email,
      up.full_name::TEXT as user_full_name,
      up.role::VARCHAR as user_system_role,
      up.is_active as user_is_active
    FROM project_members pm
    JOIN user_profiles up ON pm.user_id = up.id
    WHERE pm.project_id = p_project_id
      AND pm.status = 'active'
    ORDER BY pm.assigned_at DESC;
    RETURN;
  END IF;

  -- Non-admins: check if they are a member of this project
  IF EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND status = 'active'
  ) THEN
    RETURN QUERY
    SELECT
      pm.id,
      pm.project_id,
      pm.user_id,
      pm.role,
      pm.status,
      pm.invited_by,
      pm.assigned_at,
      pm.updated_at,
      pm.permissions,
      pm.notes,
      pm.created_at,
      up.email::TEXT as user_email,
      up.full_name::TEXT as user_full_name,
      up.role::VARCHAR as user_system_role,
      up.is_active as user_is_active
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

-- Function 6: Add project member
CREATE FUNCTION add_project_member(
  p_project_id INTEGER,
  p_user_id UUID,
  p_role VARCHAR,
  p_invited_by UUID,
  p_permissions JSONB DEFAULT '{}'::JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_manage BOOLEAN;
  v_new_member_id UUID;
BEGIN
  -- Check if inviter can manage members
  SELECT can_user_manage_members(p_project_id, p_invited_by) INTO v_can_manage;

  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'User does not have permission to add members to this project';
  END IF;

  -- Check if user already exists
  SELECT id INTO v_new_member_id
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id;

  IF v_new_member_id IS NOT NULL THEN
    RAISE EXCEPTION 'User is already a member of this project';
  END IF;

  -- Insert new member
  INSERT INTO project_members (
    project_id,
    user_id,
    role,
    status,
    invited_by,
    assigned_at,
    permissions
  ) VALUES (
    p_project_id,
    p_user_id,
    p_role,
    'active',
    p_invited_by,
    NOW(),
    p_permissions
  )
  RETURNING id INTO v_new_member_id;

  RETURN v_new_member_id;
END;
$$;

-- =====================================================
-- Add comments
-- =====================================================

COMMENT ON FUNCTION get_user_project_role(INTEGER, UUID) IS 'Get user role in project (admin/manager/editor/viewer/none)';
COMMENT ON FUNCTION get_user_project_permissions(INTEGER, UUID) IS 'Get user permissions in project as JSONB';
COMMENT ON FUNCTION can_user_manage_members(INTEGER, UUID) IS 'Check if user can manage members in project';
COMMENT ON FUNCTION get_project_member_count(INTEGER) IS 'Count active members in project';
COMMENT ON FUNCTION get_project_members_for_user(INTEGER, UUID) IS 'Get project members list with permission check';
COMMENT ON FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB) IS 'Add member to project with permission check';

-- =====================================================
-- Verification
-- =====================================================

SELECT '✅ Cleaned up duplicate functions' as status;

-- List all project-related functions with their signatures
SELECT
  routine_name,
  string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position) as parameters
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name LIKE '%project%'
GROUP BY routine_name, specific_name
ORDER BY routine_name;

SELECT '✅ Functions recreated successfully!' as result;
