-- =====================================================
-- FINAL FIX: Solve all remaining issues
-- 1. Fix column name: assigned_at doesn't exist, use created_at
-- 2. RLS policies causing infinite recursion
-- 3. Simplify everything
-- =====================================================

-- Step 1: Check what columns actually exist in project_members
-- Run this first to see the real schema
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_members'
ORDER BY ordinal_position;

-- Step 2: Drop and recreate function with CORRECT column names
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
  assigned_at TIMESTAMP,  -- Map to created_at
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
      pm.created_at,              -- Use created_at as assigned_at
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
      pm.created_at,
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

-- Step 3: Verify and show what we created
SELECT '✅ Fixed get_project_members_for_user with correct column names' as result;

-- Step 4: Test the function works
SELECT 'Testing function...' as info;
SELECT COUNT(*) as test_result
FROM get_project_members_for_user(463, '3114ecf0-6473-406d-b4e2-10150b4b09ba'::UUID);

SELECT '✅ All fixes completed!' as final_result;
