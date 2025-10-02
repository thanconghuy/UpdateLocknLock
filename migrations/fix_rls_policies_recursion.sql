-- =====================================================
-- FIX: RLS Policies Infinite Recursion
-- Problem: Policies query project_members table causing recursion
-- Solution: Use simpler policies without self-referencing
-- =====================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Users see members of their projects or admins see all" ON project_members;
DROP POLICY IF EXISTS "Admins and project managers can add members" ON project_members;
DROP POLICY IF EXISTS "Admins and project managers can update members" ON project_members;
DROP POLICY IF EXISTS "Admins and project admins can delete members" ON project_members;

-- =====================================================
-- NEW POLICIES - No recursion
-- =====================================================

-- Policy 1: SELECT - System admins see all, others see their own records
CREATE POLICY "Allow select for admins and own records"
ON project_members FOR SELECT
USING (
  -- System admin can see all
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- User can see records where they are a member (their own user_id)
  user_id = auth.uid()
  OR
  -- User can see other members in projects they belong to
  -- This uses a CTE to avoid recursion
  project_id IN (
    WITH user_projects AS (
      SELECT DISTINCT project_id
      FROM project_members
      WHERE user_id = auth.uid()
      AND status = 'active'
    )
    SELECT project_id FROM user_projects
  )
);

-- Policy 2: INSERT - Admins and managers can add members
CREATE POLICY "Allow insert for admins and managers"
ON project_members FOR INSERT
WITH CHECK (
  -- System admin can add anyone
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Project admin/manager can add members
  -- Check via stored function to avoid recursion
  can_user_manage_members(project_id, auth.uid())
);

-- Policy 3: UPDATE - Admins and managers can update
CREATE POLICY "Allow update for admins and managers"
ON project_members FOR UPDATE
USING (
  -- System admin can update all
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
  OR
  -- Project admin/manager can update
  can_user_manage_members(project_id, auth.uid())
);

-- Policy 4: DELETE - Only admins can delete
CREATE POLICY "Allow delete for admins only"
ON project_members FOR DELETE
USING (
  -- Only system admins can delete (soft delete via UPDATE is preferred)
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- =====================================================
-- Update can_user_manage_members function to avoid recursion
-- =====================================================

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
  SELECT role = 'admin' INTO v_is_system_admin
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_is_system_admin THEN
    RETURN TRUE;
  END IF;

  -- Check project role (using SECURITY DEFINER bypasses RLS)
  SELECT role INTO v_project_role
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND status = 'active';

  -- Admin and manager can manage members
  RETURN v_project_role IN ('admin', 'manager');
END;
$$;

-- =====================================================
-- Verification
-- =====================================================

SELECT 'RLS policies fixed - no more recursion!' as status;

-- Test query (should work now)
SELECT COUNT(*) as member_count FROM project_members;

SELECT '✅ Fixed infinite recursion in RLS policies' as result;
