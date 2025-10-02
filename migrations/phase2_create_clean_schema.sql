-- =====================================================
-- PHASE 2: CREATE CLEAN PROJECT MEMBERS SCHEMA
-- Date: 2025-10-02
-- Description: Tạo clean schema với 4 roles đồng bộ
-- =====================================================

-- =====================================================
-- STEP 1: CREATE PROJECT_ROLES TABLE (4 roles)
-- =====================================================

CREATE TABLE project_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL, -- 100=admin, 80=manager, 60=editor, 40=viewer
  default_permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert 4 roles (đồng bộ với System Roles)
INSERT INTO project_roles (name, display_name, description, level, default_permissions) VALUES
(
  'admin',
  'Quản trị viên',
  'Toàn quyền quản lý project, members, products và WooCommerce',
  100,
  '{
    "can_edit_project": true,
    "can_delete_project": true,
    "can_manage_members": true,
    "can_edit_products": true,
    "can_manage_woocommerce": true,
    "can_view_analytics": true
  }'::JSONB
),
(
  'manager',
  'Người quản lý',
  'Quản lý members và products, không thể xóa project',
  80,
  '{
    "can_edit_project": true,
    "can_delete_project": false,
    "can_manage_members": true,
    "can_edit_products": true,
    "can_manage_woocommerce": true,
    "can_view_analytics": true
  }'::JSONB
),
(
  'editor',
  'Biên tập viên',
  'Chỉnh sửa products và sync WooCommerce',
  60,
  '{
    "can_edit_project": false,
    "can_delete_project": false,
    "can_manage_members": false,
    "can_edit_products": true,
    "can_manage_woocommerce": true,
    "can_view_analytics": true
  }'::JSONB
),
(
  'viewer',
  'Người xem',
  'Chỉ xem project và products, không chỉnh sửa',
  40,
  '{
    "can_edit_project": false,
    "can_delete_project": false,
    "can_manage_members": false,
    "can_edit_products": false,
    "can_manage_woocommerce": false,
    "can_view_analytics": true
  }'::JSONB
);

-- Comments
COMMENT ON TABLE project_roles IS '4 vai trò chuẩn trong project (đồng bộ với System Roles)';
COMMENT ON COLUMN project_roles.level IS 'Level: 100=admin, 80=manager, 60=editor, 40=viewer';
COMMENT ON COLUMN project_roles.default_permissions IS 'Permissions mặc định của role (có thể override trong project_members)';

-- RLS for project_roles (Read-only for authenticated users)
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_users_can_view_roles"
ON project_roles FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = TRUE
);

SELECT '✅ Step 1: Created project_roles table with 4 roles' as status;

-- =====================================================
-- STEP 2: CREATE PROJECT_MEMBERS TABLE
-- =====================================================

CREATE TABLE project_members (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys (⚠️ CHÚ Ý: project_id là INTEGER)
  project_id INTEGER NOT NULL
    REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Role & Status
  role VARCHAR(50) NOT NULL DEFAULT 'viewer'
    REFERENCES project_roles(name) ON UPDATE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'removed', 'suspended')),

  -- Permissions & Metadata
  permissions JSONB DEFAULT '{}',  -- Override default_permissions
  notes TEXT,
  invited_by UUID REFERENCES user_profiles(id),

  -- Timestamps (⚠️ CONSISTENT NAMING)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(project_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_pm_project ON project_members(project_id);
CREATE INDEX idx_pm_user ON project_members(user_id);
CREATE INDEX idx_pm_status ON project_members(status);
CREATE INDEX idx_pm_role ON project_members(role);
CREATE INDEX idx_pm_composite ON project_members(project_id, user_id, status);

-- Comments
COMMENT ON TABLE project_members IS 'Quản lý thành viên của từng project với 4 roles đồng bộ';
COMMENT ON COLUMN project_members.project_id IS 'INTEGER reference to projects.project_id';
COMMENT ON COLUMN project_members.role IS '4 roles: admin, manager, editor, viewer';
COMMENT ON COLUMN project_members.permissions IS 'Custom permissions override default_permissions';

-- Simple RLS (Admin-only direct access)
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admins_full_access"
ON project_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

SELECT '✅ Step 2: Created project_members table with indexes and RLS' as status;

-- =====================================================
-- STEP 3: CREATE SECURITY DEFINER FUNCTIONS
-- =====================================================

-- Function 1: Get Project Members
CREATE OR REPLACE FUNCTION get_project_members(
  p_project_id INTEGER,
  p_requesting_user_id UUID
)
RETURNS TABLE (
  member_id UUID,
  project_id INTEGER,
  user_id UUID,
  user_email VARCHAR,
  user_full_name VARCHAR,
  user_system_role VARCHAR,
  project_role VARCHAR,
  status VARCHAR,
  permissions JSONB,
  created_at TIMESTAMPTZ,
  invited_by UUID
) AS $$
BEGIN
  -- Permission check
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = p_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project member
    EXISTS (SELECT 1 FROM project_members WHERE project_id = p_project_id AND user_id = p_requesting_user_id AND status = 'active')
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot view members of this project';
  END IF;

  -- Return members với JOIN
  RETURN QUERY
  SELECT
    pm.id AS member_id,
    pm.project_id,
    pm.user_id,
    up.email AS user_email,
    up.full_name AS user_full_name,
    up.role AS user_system_role,
    pm.role AS project_role,
    pm.status,
    COALESCE(
      pm.permissions,
      (SELECT default_permissions FROM project_roles WHERE name = pm.role)
    ) AS permissions,
    pm.created_at,
    pm.invited_by
  FROM project_members pm
  JOIN user_profiles up ON pm.user_id = up.id
  WHERE pm.project_id = p_project_id
    AND pm.status = 'active'
  ORDER BY pm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_project_members TO authenticated;

SELECT '✅ Step 3.1: Created get_project_members function' as status;

-- Function 2: Get Available Users for Project
CREATE OR REPLACE FUNCTION get_available_users_for_project(
  p_project_id INTEGER,
  p_requesting_user_id UUID
)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  full_name VARCHAR,
  system_role VARCHAR,
  is_active BOOLEAN
) AS $$
BEGIN
  -- Permission check: Chỉ admin hoặc manager mới xem
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = p_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project admin/manager (level >= 80)
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN project_roles pr ON pm.role = pr.name
      WHERE pm.project_id = p_project_id
        AND pm.user_id = p_requesting_user_id
        AND pm.status = 'active'
        AND pr.level >= 80
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot manage members of this project';
  END IF;

  -- Return users chưa là member
  RETURN QUERY
  SELECT
    up.id AS user_id,
    up.email,
    up.full_name,
    up.role AS system_role,
    up.is_active
  FROM user_profiles up
  WHERE up.is_active = TRUE
    AND up.id NOT IN (
      SELECT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.status = 'active'
    )
  ORDER BY up.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_available_users_for_project TO authenticated;

SELECT '✅ Step 3.2: Created get_available_users_for_project function' as status;

-- Function 3: Add Project Member
CREATE OR REPLACE FUNCTION add_project_member(
  p_project_id INTEGER,
  p_user_id UUID,
  p_role VARCHAR,
  p_requesting_user_id UUID,
  p_custom_permissions JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_new_member_id UUID;
  v_requesting_user_level INTEGER;
  v_new_role_level INTEGER;
BEGIN
  -- Permission check
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = p_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project admin/manager (level >= 80)
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN project_roles pr ON pm.role = pr.name
      WHERE pm.project_id = p_project_id
        AND pm.user_id = p_requesting_user_id
        AND pm.status = 'active'
        AND pr.level >= 80
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot manage members of this project';
  END IF;

  -- Get role levels
  SELECT level INTO v_requesting_user_level
  FROM project_members pm
  JOIN project_roles pr ON pm.role = pr.name
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_requesting_user_id
    AND pm.status = 'active';

  -- System admin hoặc owner → level = 100
  IF v_requesting_user_level IS NULL THEN
    v_requesting_user_level := 100;
  END IF;

  SELECT level INTO v_new_role_level
  FROM project_roles
  WHERE name = p_role;

  -- Business rule: Không thể assign role cao hơn role của mình
  IF v_new_role_level > v_requesting_user_level THEN
    RAISE EXCEPTION 'Permission denied: Cannot assign role higher than your own';
  END IF;

  -- Check user đã là member chưa
  IF EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'User is already a member of this project';
  END IF;

  -- Insert member
  INSERT INTO project_members (
    project_id,
    user_id,
    role,
    status,
    permissions,
    invited_by
  ) VALUES (
    p_project_id,
    p_user_id,
    p_role,
    'active',
    p_custom_permissions,
    p_requesting_user_id
  )
  RETURNING id INTO v_new_member_id;

  RETURN v_new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION add_project_member TO authenticated;

SELECT '✅ Step 3.3: Created add_project_member function' as status;

-- Function 4: Update Member Role
CREATE OR REPLACE FUNCTION update_project_member_role(
  p_member_id UUID,
  p_new_role VARCHAR,
  p_requesting_user_id UUID,
  p_custom_permissions JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id INTEGER;
  v_target_user_id UUID;
  v_requesting_user_level INTEGER;
  v_new_role_level INTEGER;
BEGIN
  -- Get member info
  SELECT project_id, user_id INTO v_project_id, v_target_user_id
  FROM project_members
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Permission check
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = v_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project admin/manager (level >= 80)
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN project_roles pr ON pm.role = pr.name
      WHERE pm.project_id = v_project_id
        AND pm.user_id = p_requesting_user_id
        AND pm.status = 'active'
        AND pr.level >= 80
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot manage members of this project';
  END IF;

  -- Business rule: Không thể update role của chính mình
  IF v_target_user_id = p_requesting_user_id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  -- Get role levels
  SELECT level INTO v_requesting_user_level
  FROM project_members pm
  JOIN project_roles pr ON pm.role = pr.name
  WHERE pm.project_id = v_project_id
    AND pm.user_id = p_requesting_user_id
    AND pm.status = 'active';

  IF v_requesting_user_level IS NULL THEN
    v_requesting_user_level := 100;
  END IF;

  SELECT level INTO v_new_role_level
  FROM project_roles
  WHERE name = p_new_role;

  -- Business rule: Không thể assign role cao hơn role của mình
  IF v_new_role_level > v_requesting_user_level THEN
    RAISE EXCEPTION 'Permission denied: Cannot assign role higher than your own';
  END IF;

  -- Update
  UPDATE project_members
  SET
    role = p_new_role,
    permissions = COALESCE(p_custom_permissions, permissions),
    updated_at = NOW()
  WHERE id = p_member_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_project_member_role TO authenticated;

SELECT '✅ Step 3.4: Created update_project_member_role function' as status;

-- Function 5: Remove Member
CREATE OR REPLACE FUNCTION remove_project_member(
  p_member_id UUID,
  p_requesting_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id INTEGER;
  v_target_user_id UUID;
  v_admin_count INTEGER;
BEGIN
  -- Get member info
  SELECT project_id, user_id INTO v_project_id, v_target_user_id
  FROM project_members
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Permission check
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = v_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project admin
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = v_project_id
        AND pm.user_id = p_requesting_user_id
        AND pm.status = 'active'
        AND pm.role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot remove members from this project';
  END IF;

  -- Business rule: Không thể remove chính mình
  IF v_target_user_id = p_requesting_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself from the project';
  END IF;

  -- Business rule: Phải có ít nhất 1 admin
  SELECT COUNT(*) INTO v_admin_count
  FROM project_members
  WHERE project_id = v_project_id
    AND status = 'active'
    AND role = 'admin';

  IF v_admin_count = 1 AND (
    SELECT role FROM project_members WHERE id = p_member_id
  ) = 'admin' THEN
    RAISE EXCEPTION 'Cannot remove the last admin from the project';
  END IF;

  -- Soft delete (set status = removed)
  UPDATE project_members
  SET
    status = 'removed',
    updated_at = NOW()
  WHERE id = p_member_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION remove_project_member TO authenticated;

SELECT '✅ Step 3.5: Created remove_project_member function' as status;

-- =====================================================
-- STEP 4: VERIFICATION
-- =====================================================

-- Verify roles created
SELECT '=== VERIFICATION ===' as status;

SELECT 'project_roles table:' as info;
SELECT id, name, display_name, level FROM project_roles ORDER BY level DESC;

SELECT 'project_members table:' as info;
SELECT COUNT(*) as member_count FROM project_members;

SELECT 'Functions created:' as info;
SELECT proname as function_name
FROM pg_proc
WHERE proname IN (
  'get_project_members',
  'get_available_users_for_project',
  'add_project_member',
  'update_project_member_role',
  'remove_project_member'
)
ORDER BY proname;

-- =====================================================
-- FINAL MESSAGE
-- =====================================================

SELECT '✅ PHASE 2 COMPLETED SUCCESSFULLY!' as status;
SELECT 'Created:' as summary;
SELECT '  - 4 project roles (admin, manager, editor, viewer)' as detail_1;
SELECT '  - project_members table with proper schema' as detail_2;
SELECT '  - 5 SECURITY DEFINER functions with business logic' as detail_3;
SELECT '  - Simple RLS policies (admin-only direct access)' as detail_4;
SELECT 'Ready for Phase 3: Implement Service Layer' as next_step;
