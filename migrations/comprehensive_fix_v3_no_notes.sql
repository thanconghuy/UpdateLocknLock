-- =====================================================
-- COMPREHENSIVE FIX V3: All Project Members Issues
-- V3 Changes: Remove pm.notes column (doesn't exist)
-- Fixed all type casting issues
-- =====================================================

-- Step 1: Fix get_project_members_for_user (WITHOUT notes column)
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

-- Step 3: Fix get_user_project_permissions
DROP FUNCTION IF EXISTS get_user_project_permissions(INTEGER, UUID);

CREATE OR REPLACE FUNCTION get_user_project_permissions(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_user_role TEXT;
  v_role_level INTEGER;
  v_default_permissions JSONB;
  v_custom_permissions JSONB;
  v_final_permissions JSONB;
BEGIN
  -- Check if user is system admin
  SELECT (up.role::TEXT = 'admin') INTO v_is_admin
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- Admin has full permissions
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'can_manage_members', true,
      'can_edit_project', true,
      'can_delete_project', true,
      'can_manage_woocommerce', true,
      'can_edit_products', true,
      'can_view_analytics', true
    );
  END IF;

  -- Get user's role and custom permissions in this project
  SELECT pm.role::TEXT, pm.permissions
  INTO v_user_role, v_custom_permissions
  FROM project_members pm
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_user_id
    AND pm.status::TEXT = 'active';

  -- If not a member, return no permissions
  IF v_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'can_manage_members', false,
      'can_edit_project', false,
      'can_delete_project', false,
      'can_manage_woocommerce', false,
      'can_edit_products', false,
      'can_view_analytics', false
    );
  END IF;

  -- Get default permissions for this role
  SELECT pr.default_permissions
  INTO v_default_permissions
  FROM project_roles pr
  WHERE pr.name::TEXT = v_user_role;

  -- Merge default permissions with custom overrides
  IF v_custom_permissions IS NOT NULL THEN
    v_final_permissions := v_default_permissions || v_custom_permissions;
  ELSE
    v_final_permissions := v_default_permissions;
  END IF;

  RETURN v_final_permissions;
END;
$$;

-- Step 4: Fix get_user_project_role
DROP FUNCTION IF EXISTS get_user_project_role(INTEGER, UUID);

CREATE OR REPLACE FUNCTION get_user_project_role(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR;
BEGIN
  -- Get user's role in this project
  SELECT pm.role::VARCHAR INTO v_role
  FROM project_members pm
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_user_id
    AND pm.status::TEXT = 'active';

  RETURN COALESCE(v_role, 'none');
END;
$$;

-- Step 5: Fix can_user_manage_members
DROP FUNCTION IF EXISTS can_user_manage_members(INTEGER, UUID);

CREATE OR REPLACE FUNCTION can_user_manage_members(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS BOOLEAN
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

  -- Admin can always manage members
  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- Get user's role in this project
  SELECT pm.role::TEXT INTO v_user_role
  FROM project_members pm
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_user_id
    AND pm.status::TEXT = 'active';

  -- If not a member, cannot manage
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;

  -- Get role level
  SELECT pr.level INTO v_role_level
  FROM project_roles pr
  WHERE pr.name::TEXT = v_user_role;

  -- Manager level (>=80) can manage members
  RETURN (v_role_level IS NOT NULL AND v_role_level >= 80);
END;
$$;

-- Step 6: Fix add_project_member
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

-- Step 7: Grant execute permissions
GRANT EXECUTE ON FUNCTION get_project_members_for_user(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_users_for_project(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_project_permissions(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_project_role(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_manage_members(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB) TO authenticated;

-- Step 8: Verify functions created
SELECT '✅ All 6 functions created successfully!' as result;

-- List all functions
SELECT
  proname as function_name,
  pg_get_function_identity_arguments(oid) as signature
FROM pg_proc
WHERE proname IN (
  'get_project_members_for_user',
  'get_available_users_for_project',
  'get_user_project_permissions',
  'get_user_project_role',
  'can_user_manage_members',
  'add_project_member'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

SELECT '✅ Comprehensive Fix V3 completed!' as final_result;
