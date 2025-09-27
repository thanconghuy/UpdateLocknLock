-- ====================================
-- BƯỚC 6: THÊM DỮ LIỆU MẶC ĐỊNH
-- ====================================

-- 6.1. Thêm default permission templates
INSERT INTO permission_templates (name, role, permissions, description, is_system_template) VALUES

-- Admin Template
('Admin Full Access', 'admin', '{
    "system": ["manage_users", "manage_settings", "view_logs", "manage_projects"],
    "projects": ["create", "read", "update", "delete", "manage_members"],
    "products": ["create", "read", "update", "delete", "import", "export"],
    "reports": ["view_all", "export"]
}', 'Toàn quyền hệ thống', TRUE),

-- Manager Template
('Manager Standard', 'manager', '{
    "projects": ["create", "read", "update", "manage_members"],
    "products": ["read", "update", "import"],
    "reports": ["view_own_projects"],
    "limits": {"max_projects": 10, "max_team_members": 5}
}', 'Quản lý project tiêu chuẩn', TRUE),

-- Product Editor Template
('Product Editor', 'product_editor', '{
    "projects": ["read"],
    "products": ["read", "update", "import"],
    "reports": ["view_assigned_projects"]
}', 'Chỉnh sửa sản phẩm', TRUE),

-- Project Viewer Template
('Project Viewer', 'project_viewer', '{
    "projects": ["read"],
    "products": ["read"],
    "reports": ["view_assigned_projects"]
}', 'Xem project (read-only)', TRUE),

-- Basic Viewer Template
('Basic Viewer', 'viewer', '{
    "dashboard": ["view_basic"],
    "projects": ["read_assigned"],
    "products": ["read_assigned"]
}', 'Quyền xem cơ bản', TRUE)

ON CONFLICT (name) DO UPDATE SET
    permissions = EXCLUDED.permissions,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 6.2. Log activity cho việc setup system
INSERT INTO user_activity_logs (user_id, action, resource_type, details)
SELECT
    id as user_id,
    'system_setup',
    'permission_system',
    '{"action": "permission_system_initialized", "version": "2.0"}'
FROM user_profiles
WHERE role = 'admin'
LIMIT 1;

-- COMPLETED: ✅ Bước 6 hoàn thành
SELECT '✅ BƯỚC 6: Thêm dữ liệu mặc định - HOÀN THÀNH' as status;