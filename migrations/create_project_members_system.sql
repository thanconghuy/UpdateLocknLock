-- =====================================================
-- MIGRATION: Project Members System
-- Description: Tạo hệ thống quản lý thành viên project
-- Date: 2025-10-01
-- Option 1: Simple & Effective approach
-- =====================================================

-- =====================================================
-- TABLE 1: PROJECT_ROLES
-- Định nghĩa các vai trò trong project
-- =====================================================

CREATE TABLE IF NOT EXISTS project_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL, -- 4=admin, 3=manager, 2=editor, 1=viewer
  default_permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert 4 roles mặc định
INSERT INTO project_roles (name, display_name, description, level, default_permissions) VALUES
('admin', 'Project Admin', 'Quản trị viên dự án - toàn quyền quản lý project', 4,
  '{"can_manage_members": true, "can_edit_project": true, "can_delete_project": true, "can_manage_woocommerce": true, "can_edit_products": true, "can_view_analytics": true}'::JSONB),
('manager', 'Project Manager', 'Quản lý dự án - quản lý thành viên và sản phẩm', 3,
  '{"can_manage_members": true, "can_edit_project": true, "can_delete_project": false, "can_manage_woocommerce": true, "can_edit_products": true, "can_view_analytics": true}'::JSONB),
('editor', 'Product Editor', 'Biên tập viên - chỉnh sửa sản phẩm', 2,
  '{"can_manage_members": false, "can_edit_project": false, "can_delete_project": false, "can_manage_woocommerce": false, "can_edit_products": true, "can_view_analytics": true}'::JSONB),
('viewer', 'Viewer', 'Người xem - chỉ xem dữ liệu', 1,
  '{"can_manage_members": false, "can_edit_project": false, "can_delete_project": false, "can_manage_woocommerce": false, "can_edit_products": false, "can_view_analytics": true}'::JSONB)
ON CONFLICT (name) DO NOTHING;

COMMENT ON TABLE project_roles IS 'Định nghĩa các vai trò (roles) có thể có trong project';
COMMENT ON COLUMN project_roles.level IS 'Level càng cao thì quyền hạn càng lớn (4=highest, 1=lowest)';
COMMENT ON COLUMN project_roles.default_permissions IS 'Quyền mặc định của role (có thể override ở project_members)';

-- =====================================================
-- TABLE 2: PROJECT_MEMBERS
-- Quản lý thành viên của từng project
-- =====================================================

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'viewer' REFERENCES project_roles(name) ON UPDATE CASCADE,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'removed', 'suspended')),
  invited_by UUID REFERENCES user_profiles(id),
  assigned_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  permissions JSONB DEFAULT '{}', -- Custom permissions override (nếu cần)
  notes TEXT, -- Ghi chú về thành viên này

  -- Constraints
  UNIQUE(project_id, user_id), -- Mỗi user chỉ có 1 role trong 1 project

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_status ON project_members(status);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
CREATE INDEX IF NOT EXISTS idx_project_members_composite ON project_members(project_id, user_id, status);

COMMENT ON TABLE project_members IS 'Quản lý danh sách thành viên của từng project';
COMMENT ON COLUMN project_members.status IS 'active: đang hoạt động, removed: đã xóa, suspended: tạm ngưng';
COMMENT ON COLUMN project_members.permissions IS 'Custom permissions để override default_permissions của role (nếu cần)';

-- =====================================================
-- RLS POLICIES cho PROJECT_MEMBERS
-- =====================================================

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

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
-- RLS POLICIES cho PROJECT_ROLES (Read-only for all authenticated users)
-- =====================================================

ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read available roles
CREATE POLICY "Authenticated users can view roles"
ON project_roles FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = TRUE
);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function 1: Get user's role in a project
CREATE OR REPLACE FUNCTION get_user_project_role(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS VARCHAR AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_project_role IS 'Lấy vai trò của user trong project. System admin luôn trả về admin. Trả về none nếu user không phải member.';

-- Function 2: Get user's permissions in a project
CREATE OR REPLACE FUNCTION get_user_project_permissions(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_project_permissions IS 'Lấy tất cả permissions của user trong project. Custom permissions sẽ override default permissions.';

-- Function 3: Check if user can manage members in project
CREATE OR REPLACE FUNCTION can_user_manage_members(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_permissions JSONB;
BEGIN
  v_permissions := get_user_project_permissions(p_project_id, p_user_id);
  RETURN (v_permissions->>'can_manage_members')::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_user_manage_members IS 'Kiểm tra xem user có quyền quản lý thành viên trong project không';

-- Function 4: Get member count for a project
CREATE OR REPLACE FUNCTION get_project_member_count(p_project_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM project_members
    WHERE project_id = p_project_id
      AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_project_member_count IS 'Đếm số lượng thành viên active trong project';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger: Auto update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_project_members_updated_at ON project_members;
CREATE TRIGGER update_project_members_updated_at
  BEFORE UPDATE ON project_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_roles_updated_at ON project_roles;
CREATE TRIGGER update_project_roles_updated_at
  BEFORE UPDATE ON project_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify roles created
SELECT 'Roles created:' as info, COUNT(*) as count FROM project_roles;
SELECT * FROM project_roles ORDER BY level DESC;

-- Verify tables exist
SELECT 'Tables created:' as info;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('project_roles', 'project_members')
ORDER BY table_name;

-- Verify functions exist
SELECT 'Functions created:' as info;
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%project%'
ORDER BY routine_name;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

SELECT '✅ Migration completed successfully!' as status;
SELECT 'Created tables: project_roles, project_members' as info;
SELECT 'Created 4 default roles: admin, manager, editor, viewer' as info;
SELECT 'Created 4 helper functions for permissions' as info;
SELECT 'Created RLS policies for secure access' as info;
