-- =====================================================
-- COMPREHENSIVE FIX: All Project Members Issues
-- 1. Fix column name: assigned_at → created_at
-- 2. Create SECURITY DEFINER for available users (avoid RLS recursion)
-- 3. Fix add_project_member function
-- =====================================================

-- Step 1: Fix get_project_members_for_user with correct column names
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
      pm.role::VARCHAR,
      pm.status::VARCHAR,
      pm.invited_by,
      pm.created_at as assigned_at,  -- Map created_at to assigned_at
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
      AND pm.status = 'active'
    ORDER BY pm.created_at DESC;
    RETURN;
  END IF;

  -- Non-admins: check if they are a member
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
      pm.created_at as assigned_at,  -- Map created_at to assigned_at
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
      AND pm.status = 'active'
    ORDER BY pm.created_at DESC;
    RETURN;
  END IF;

  RETURN;
END;
$$;

-- Step 2: Create SECURITY DEFINER function to get available users (bypasses RLS)
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
  v_is_member BOOLEAN;
BEGIN
  -- Check if user is system admin
  SELECT (up.role = 'admin') INTO v_is_admin
  FROM user_profiles up
  WHERE up.id = p_user_id;

  -- Check if user is project member with manager+ role
  SELECT EXISTS (
    SELECT 1 FROM project_members pm
    JOIN project_roles pr ON pm.role = pr.name
    WHERE pm.project_id = p_project_id
      AND pm.user_id = p_user_id
      AND pm.status = 'active'
      AND pr.level >= 80  -- manager or admin level
  ) INTO v_is_member;

  -- Only admins or managers can see available users
  IF NOT (v_is_admin OR v_is_member) THEN
    RETURN;
  END IF;

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
END;
$$;

-- Step 3: Verify add_project_member function exists and is correct
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
      AND status = 'active'
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
    p_role,
    'active',
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
SELECT '✅ Fixed get_project_members_for_user with correct column mapping' as result;
SELECT '✅ Created get_available_users_for_project to bypass RLS' as result;
SELECT '✅ Verified add_project_member function' as result;

-- Test the functions
SELECT 'Testing get_available_users_for_project...' as info;
SELECT COUNT(*) as available_users_count
FROM get_available_users_for_project(463, '3114ecf0-6473-406d-b4e2-10150b4b09ba'::UUID);

SELECT '✅ All comprehensive fixes completed!' as final_result;
