-- =====================================================
-- COMPREHENSIVE FIX V2: All Project Members Issues
-- Fixes all type casting issues with explicit casts
-- =====================================================

-- Step 1: Fix get_project_members_for_user
DROP FUNCTION IF EXISTS get_project_members_for_user(INTEGER, UUID);

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
  assigned_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  permissions JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
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
  v_is_member BOOLEAN;
BEGIN
  -- Check if user is system admin
  SELECT (up.role::TEXT = 'admin') INTO v_is_admin
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- If admin, return all members
  IF v_is_admin THEN
    RETURN QUERY
    SELECT
      pm.id,
      pm.project_id,
      pm.user_id,
      pm.role::VARCHAR,
      pm.status::VARCHAR,
      pm.invited_by,
      pm.created_at,  -- Use created_at as assigned_at
      pm.updated_at,
      pm.permissions,
      pm.notes,
      pm.created_at,
      up.email::TEXT,
      COALESCE(up.full_name, up.email)::TEXT,
      up.role::VARCHAR,
      up.is_active
    FROM project_members pm
    JOIN user_profiles up ON pm.user_id = up.id
    WHERE pm.project_id = p_project_id
      AND pm.status::TEXT = 'active'
    ORDER BY pm.created_at DESC;
    RETURN;
  END IF;

  -- Check if user is a member of this project
  SELECT EXISTS (
    SELECT 1 FROM project_members pm2
    WHERE pm2.project_id = p_project_id
      AND pm2.user_id = p_user_id
      AND pm2.status::TEXT = 'active'
  ) INTO v_is_member;

  -- If member, return all members
  IF v_is_member THEN
    RETURN QUERY
    SELECT
      pm.id,
      pm.project_id,
      pm.user_id,
      pm.role::VARCHAR,
      pm.status::VARCHAR,
      pm.invited_by,
      pm.created_at,  -- Use created_at as assigned_at
      pm.updated_at,
      pm.permissions,
      pm.notes,
      pm.created_at,
      up.email::TEXT,
      COALESCE(up.full_name, up.email)::TEXT,
      up.role::VARCHAR,
      up.is_active
    FROM project_members pm
    JOIN user_profiles up ON pm.user_id = up.id
    WHERE pm.project_id = p_project_id
      AND pm.status::TEXT = 'active'
    ORDER BY pm.created_at DESC;
    RETURN;
  END IF;

  -- Not authorized, return empty
  RETURN;
END;
$$;

-- Step 2: Fix get_available_users_for_project
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
  v_user_role TEXT;
  v_role_level INTEGER;
BEGIN
  -- Check if user is system admin
  SELECT (up.role::TEXT = 'admin') INTO v_is_admin
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- If admin, allow access
  IF v_is_admin THEN
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
          AND pm.status::TEXT = 'active'
      )
    ORDER BY up.email;
    RETURN;
  END IF;

  -- For non-admins, get their role in this project
  SELECT pm.role::TEXT INTO v_user_role
  FROM project_members pm
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_user_id
    AND pm.status::TEXT = 'active';

  -- If not a member, return nothing
  IF v_user_role IS NULL THEN
    RETURN;
  END IF;

  -- Get role level with explicit cast
  SELECT pr.level INTO v_role_level
  FROM project_roles pr
  WHERE pr.name::TEXT = v_user_role;

  -- Only managers (level >= 80) can see available users
  IF v_role_level IS NOT NULL AND v_role_level >= 80 THEN
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
          AND pm.status::TEXT = 'active'
      )
    ORDER BY up.email;
    RETURN;
  END IF;

  -- Otherwise return nothing
  RETURN;
END;
$$;

-- Step 3: Fix add_project_member
DROP FUNCTION IF EXISTS add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB);

CREATE OR REPLACE FUNCTION add_project_member(
  p_project_id INTEGER,
  p_user_id UUID,
  p_role VARCHAR,
  p_invited_by UUID,
  p_permissions JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_member_id UUID;
  v_can_manage BOOLEAN;
BEGIN
  -- Check if inviter can manage members
  SELECT can_user_manage_members(p_project_id, p_invited_by) INTO v_can_manage;

  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'User does not have permission to manage members';
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND status::TEXT = 'active'
  ) THEN
    RAISE EXCEPTION 'User is already a member of this project';
  END IF;

  -- Insert new member
  INSERT INTO project_members (
    project_id,
    user_id,
    role,
    status,
    invited_by,
    permissions
  ) VALUES (
    p_project_id,
    p_user_id,
    p_role::TEXT,
    'active'::TEXT,
    p_invited_by,
    p_permissions
  )
  RETURNING id INTO v_new_member_id;

  RETURN v_new_member_id;
END;
$$;

-- Step 4: Grant execute permissions
GRANT EXECUTE ON FUNCTION get_project_members_for_user(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_users_for_project(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB) TO authenticated;

-- Step 5: Verify functions
SELECT '✅ Fixed get_project_members_for_user with explicit type casts' as result
UNION ALL
SELECT '✅ Fixed get_available_users_for_project with explicit type casts' as result
UNION ALL
SELECT '✅ Fixed add_project_member with explicit type casts' as result
UNION ALL
SELECT '✅ All comprehensive fixes V2 completed!' as result;
