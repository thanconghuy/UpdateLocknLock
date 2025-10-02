-- =====================================================
-- FIX: RLS Policies - Final Fix
-- Problem: Function signature mismatch and recursion
-- Solution: Simplify policies, avoid recursion completely
-- =====================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users see members of their projects or admins see all" ON project_members;
DROP POLICY IF EXISTS "Admins and project managers can add members" ON project_members;
DROP POLICY IF EXISTS "Admins and project managers can update members" ON project_members;
DROP POLICY IF EXISTS "Admins and project admins can delete members" ON project_members;
DROP POLICY IF EXISTS "Allow select for admins and own records" ON project_members;
DROP POLICY IF EXISTS "Allow insert for admins and managers" ON project_members;
DROP POLICY IF EXISTS "Allow update for admins and managers" ON project_members;
DROP POLICY IF EXISTS "Allow delete for admins only" ON project_members;

-- =====================================================
-- SIMPLIFIED POLICIES - No recursion, no complex CTEs
-- =====================================================

-- Policy 1: SELECT - Admins see all, others see nothing (will be handled by service layer)
CREATE POLICY "Admins can view all members"
ON project_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy 2: INSERT - Only admins can add members
CREATE POLICY "Admins can insert members"
ON project_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy 3: UPDATE - Only admins can update members
CREATE POLICY "Admins can update members"
ON project_members FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Policy 4: DELETE - Only admins can delete members
CREATE POLICY "Admins can delete members"
ON project_members FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- =====================================================
-- Alternative: More permissive policies with service_role
-- If you want non-admins to manage members, we'll handle
-- permissions in application layer using service functions
-- =====================================================

COMMENT ON TABLE project_members IS 'RLS: Only admins have direct access. Non-admin permissions handled via SECURITY DEFINER functions.';

-- =====================================================
-- Update helper functions to use SECURITY DEFINER
-- These bypass RLS and implement custom logic
-- =====================================================

-- Function to get members (bypasses RLS)
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
  SELECT role = 'admin' INTO v_is_admin
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
      up.email as user_email,
      up.full_name as user_full_name,
      up.role as user_system_role,
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
      up.email as user_email,
      up.full_name as user_full_name,
      up.role as user_system_role,
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

COMMENT ON FUNCTION get_project_members_for_user IS 'Get project members with permission check. Bypasses RLS using SECURITY DEFINER.';

-- Function to add member (bypasses RLS)
CREATE OR REPLACE FUNCTION add_project_member(
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

COMMENT ON FUNCTION add_project_member IS 'Add member to project with permission check. Bypasses RLS.';

-- Update can_user_manage_members to be more robust
CREATE OR REPLACE FUNCTION can_user_manage_members(
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

-- =====================================================
-- Verification
-- =====================================================

SELECT '✅ RLS policies simplified - admin-only access' as status;
SELECT 'Non-admin access via SECURITY DEFINER functions' as info;

-- Test functions exist
SELECT 'Functions available:' as info;
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%member%'
ORDER BY routine_name;

SELECT '✅ Migration completed!' as result;
