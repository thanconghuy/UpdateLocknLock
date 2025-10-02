-- =====================================================
-- MIGRATION: Update Project Members System
-- Description: Tạo bảng project_members và update functions
-- Date: 2025-10-01
-- Note: project_roles đã tồn tại, chỉ cần tạo project_members
-- =====================================================

-- =====================================================
-- STEP 1: DROP existing functions if exist (fix name conflict)
-- =====================================================

DROP FUNCTION IF EXISTS get_user_project_role(INTEGER, UUID);
DROP FUNCTION IF EXISTS get_user_project_permissions(INTEGER, UUID);
DROP FUNCTION IF EXISTS can_user_manage_members(INTEGER, UUID);
DROP FUNCTION IF EXISTS get_project_member_count(INTEGER);

-- =====================================================
-- STEP 2: CREATE TABLE project_members (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'removed', 'suspended')),
  invited_by UUID REFERENCES user_profiles(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  permissions JSONB DEFAULT '{}', -- Custom permissions override (nếu cần)
  notes TEXT, -- Ghi chú về thành viên này
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  UNIQUE(project_id, user_id) -- Mỗi user chỉ có 1 role trong 1 project
);

COMMENT ON TABLE project_members IS 'Quản lý danh sách thành viên của từng project';
COMMENT ON COLUMN project_members.status IS 'active: đang hoạt động, removed: đã xóa, suspended: tạm ngưng';
COMMENT ON COLUMN project_members.permissions IS 'Custom permissions để override default_permissions của role (nếu cần)';

-- =====================================================
-- STEP 3: CREATE indexes for performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_status ON project_members(status);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
CREATE INDEX IF NOT EXISTS idx_project_members_composite ON project_members(project_id, user_id, status);

-- =====================================================
-- STEP 4: RLS POLICIES cho PROJECT_MEMBERS
-- =====================================================

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if exist
DROP POLICY IF EXISTS "Users see members of their projects or admins see all" ON project_members;
DROP POLICY IF EXISTS "Admins and project managers can add members" ON project_members;
DROP POLICY IF EXISTS "Admins and project managers can update members" ON project_members;
DROP POLICY IF EXISTS "Admins and project admins can delete members" ON project_members;

-- Policy 1: Users can see members of projects they belong to OR system admins can see all
CREATE POLICY "Users see members of their projects or admins see all"
ON project_members FOR SELECT
USING (
  -- User is system admin
  auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  )
  OR
  -- User is member of this project
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = project_members.project_id
    AND status = 'active'
  )
);

-- Policy 2: Only system admins or project admins/managers can add members
CREATE POLICY "Admins and project managers can add members"
ON project_members FOR INSERT
WITH CHECK (
  -- User is system admin
  auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  )
  OR
  -- User is project admin or manager
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = project_members.project_id
    AND role IN ('admin', 'manager')
    AND status = 'active'
  )
);

-- Policy 3: Only system admins or project admins/managers can update members
CREATE POLICY "Admins and project managers can update members"
ON project_members FOR UPDATE
USING (
  -- User is system admin
  auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  )
  OR
  -- User is project admin or manager
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = project_members.project_id
    AND role IN ('admin', 'manager')
    AND status = 'active'
  )
);

-- Policy 4: Only system admins or project admins can delete members
CREATE POLICY "Admins and project admins can delete members"
ON project_members FOR DELETE
USING (
  -- User is system admin
  auth.uid() IN (
    SELECT id FROM user_profiles WHERE role = 'admin'
  )
  OR
  -- User is project admin
  auth.uid() IN (
    SELECT user_id FROM project_members
    WHERE project_id = project_members.project_id
    AND role = 'admin'
    AND status = 'active'
  )
);

-- =====================================================
-- STEP 5: RLS POLICIES cho PROJECT_ROLES (nếu chưa có)
-- =====================================================

ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Authenticated users can view roles" ON project_roles;

-- Policy: All authenticated users can read available roles
CREATE POLICY "Authenticated users can view roles"
ON project_roles FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = TRUE
);

-- =====================================================
-- STEP 6: RECREATE HELPER FUNCTIONS with correct signatures
-- =====================================================

-- Function 1: Get user's role in a project
CREATE OR REPLACE FUNCTION get_user_project_role(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role VARCHAR;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if system admin first
  SELECT role = 'admin' INTO v_is_admin
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

COMMENT ON FUNCTION get_user_project_role(INTEGER, UUID) IS 'Lấy vai trò của user trong project. System admin luôn trả về admin. Trả về none nếu user không phải member.';

-- Function 2: Get user's permissions in a project
CREATE OR REPLACE FUNCTION get_user_project_permissions(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION get_user_project_permissions(INTEGER, UUID) IS 'Lấy tất cả permissions của user trong project. Custom permissions sẽ override default permissions.';

-- Function 3: Check if user can manage members in project
CREATE OR REPLACE FUNCTION can_user_manage_members(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_permissions JSONB;
BEGIN
  v_permissions := get_user_project_permissions(p_project_id, p_user_id);
  RETURN (v_permissions->>'can_manage_members')::BOOLEAN;
END;
$$;

COMMENT ON FUNCTION can_user_manage_members(INTEGER, UUID) IS 'Kiểm tra xem user có quyền quản lý thành viên trong project không';

-- Function 4: Get member count for a project
CREATE OR REPLACE FUNCTION get_project_member_count(
  p_project_id INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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

COMMENT ON FUNCTION get_project_member_count(INTEGER) IS 'Đếm số lượng thành viên active trong project';

-- =====================================================
-- STEP 7: TRIGGERS
-- =====================================================

-- Function for trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop existing triggers if exist
DROP TRIGGER IF EXISTS update_project_members_updated_at ON project_members;

-- Create trigger
CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 8: VERIFICATION QUERIES
-- =====================================================

-- Verify roles exist (should have 5 roles)
SELECT 'Existing roles:' as info, COUNT(*) as count FROM project_roles;
SELECT id, name, display_name, level FROM project_roles ORDER BY level DESC;

-- Verify project_members table
SELECT 'project_members table:' as info, COUNT(*) as count FROM project_members;

-- Verify functions exist
SELECT 'Functions created:' as info;
SELECT proname as function_name, pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE '%project%'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- Test functions (replace with real IDs)
-- SELECT get_user_project_role(463, 'your-user-id'::UUID);
-- SELECT get_user_project_permissions(463, 'your-user-id'::UUID);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

SELECT '✅ Migration completed successfully!' as status;
SELECT 'Table project_members created/verified' as info;
SELECT 'RLS policies applied' as info;
SELECT 'Helper functions recreated with correct signatures' as info;
