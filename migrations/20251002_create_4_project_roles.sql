-- =====================================================
-- CREATE 4 PROJECT ROLES (Đồng bộ với System Roles)
-- Date: 2025-10-02
-- Description: Tạo 4 roles đồng bộ: admin, manager, editor, viewer
-- =====================================================

-- Drop existing project_roles if exists
DROP TABLE IF EXISTS project_roles CASCADE;

-- Create project_roles table
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
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  default_permissions = EXCLUDED.default_permissions,
  updated_at = NOW();

-- Comments
COMMENT ON TABLE project_roles IS '4 vai trò chuẩn trong project (đồng bộ với System Roles)';
COMMENT ON COLUMN project_roles.level IS 'Level: 100=admin, 80=manager, 60=editor, 40=viewer';
COMMENT ON COLUMN project_roles.default_permissions IS 'Permissions mặc định của role (có thể override trong project_members)';

-- RLS for project_roles (Read-only for authenticated users)
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_users_can_view_roles" ON project_roles;
CREATE POLICY "authenticated_users_can_view_roles"
ON project_roles FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND is_active = TRUE
);

-- Verification
SELECT '✅ Created 4 project roles successfully!' as status;
SELECT
  id,
  name,
  display_name,
  level,
  default_permissions
FROM project_roles
ORDER BY level DESC;
