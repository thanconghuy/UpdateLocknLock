-- ====================================
-- ENHANCED MEMBER MANAGEMENT SCHEMA
-- ====================================

-- 1. User Roles Enum (thay thế enum cũ)
CREATE TYPE user_role AS ENUM (
    'admin',           -- Toàn quyền hệ thống
    'manager',         -- Quản lý project và team
    'product_editor',  -- Chỉnh sửa sản phẩm
    'project_viewer',  -- Xem project (read-only)
    'viewer'          -- Xem cơ bản
);

-- 2. Cập nhật bảng user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS max_projects INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_team_members INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id);

-- 3. Project Members (quan hệ user-project)
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'viewer',
    assigned_by UUID NOT NULL REFERENCES user_profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{}', -- Quyền đặc biệt cho project này

    -- Constraints
    UNIQUE(project_id, user_id),

    -- Indexes
    CREATE INDEX idx_project_members_project ON project_members(project_id),
    CREATE INDEX idx_project_members_user ON project_members(user_id),
    CREATE INDEX idx_project_members_role ON project_members(role)
);

-- 4. User Activity Log
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'login', 'project_access', 'product_update', etc.
    resource_type VARCHAR(50), -- 'project', 'product', 'user', etc.
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Indexes
    CREATE INDEX idx_activity_user_time ON user_activity_logs(user_id, created_at DESC),
    CREATE INDEX idx_activity_action ON user_activity_logs(action),
    CREATE INDEX idx_activity_resource ON user_activity_logs(resource_type, resource_id)
);

-- 5. Permission Templates (để dễ quản lý)
CREATE TABLE IF NOT EXISTS permission_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    role user_role NOT NULL,
    permissions JSONB NOT NULL,
    description TEXT,
    is_system_template BOOLEAN DEFAULT FALSE, -- Template mặc định không thể xóa
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Thêm cột project ownership
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 5;

-- 7. Permission Functions
CREATE OR REPLACE FUNCTION user_can_access_project(user_uuid UUID, project_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role_val user_role;
    is_member BOOLEAN;
BEGIN
    -- Lấy role của user
    SELECT role INTO user_role_val FROM user_profiles WHERE id = user_uuid;

    -- Admin có thể truy cập tất cả
    IF user_role_val = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Kiểm tra xem user có phải member của project không
    SELECT EXISTS(
        SELECT 1 FROM project_members
        WHERE user_id = user_uuid
        AND project_id = project_uuid
        AND is_active = TRUE
    ) INTO is_member;

    -- Hoặc là owner/manager của project
    IF NOT is_member THEN
        SELECT EXISTS(
            SELECT 1 FROM projects
            WHERE id = project_uuid
            AND (owner_id = user_uuid OR manager_id = user_uuid)
        ) INTO is_member;
    END IF;

    RETURN is_member;
END;
$$ LANGUAGE plpgsql;

-- 8. Default Permission Templates
INSERT INTO permission_templates (name, role, permissions, description, is_system_template) VALUES
('Admin Full Access', 'admin', '{
    "system": ["manage_users", "manage_settings", "view_logs", "manage_projects"],
    "projects": ["create", "read", "update", "delete", "manage_members"],
    "products": ["create", "read", "update", "delete", "import", "export"],
    "reports": ["view_all", "export"]
}', 'Toàn quyền hệ thống', TRUE),

('Manager Standard', 'manager', '{
    "projects": ["create", "read", "update", "manage_members"],
    "products": ["read", "update", "import"],
    "reports": ["view_own_projects"],
    "limits": {"max_projects": 10, "max_team_members": 5}
}', 'Quản lý project tiêu chuẩn', TRUE),

('Product Editor', 'product_editor', '{
    "projects": ["read"],
    "products": ["read", "update", "import"],
    "reports": ["view_assigned_projects"]
}', 'Chỉnh sửa sản phẩm', TRUE),

('Project Viewer', 'project_viewer', '{
    "projects": ["read"],
    "products": ["read"],
    "reports": ["view_assigned_projects"]
}', 'Xem project (read-only)', TRUE),

('Basic Viewer', 'viewer', '{
    "dashboard": ["view_basic"],
    "projects": ["read_assigned"],
    "products": ["read_assigned"]
}', 'Quyền xem cơ bản', TRUE);

-- 9. RLS Policies cập nhật
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Policy cho project_members
CREATE POLICY "Users can view project members of their projects" ON project_members
    FOR SELECT USING (
        auth.uid() IN (
            -- User là member của project
            SELECT user_id FROM project_members pm2 WHERE pm2.project_id = project_members.project_id,
            -- Hoặc là admin
            SELECT id FROM user_profiles WHERE id = auth.uid() AND role = 'admin',
            -- Hoặc là owner/manager của project
            SELECT owner_id FROM projects p WHERE p.id = project_members.project_id
            UNION
            SELECT manager_id FROM projects p WHERE p.id = project_members.project_id
        )
    );

CREATE POLICY "Managers can manage their project members" ON project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND (
                up.role = 'admin'
                OR (
                    up.role = 'manager'
                    AND project_members.project_id IN (
                        SELECT p.id FROM projects p
                        WHERE p.owner_id = auth.uid() OR p.manager_id = auth.uid()
                    )
                )
            )
        )
    );

-- Policy cho user_activity_logs
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity logs" ON user_activity_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all activity logs" ON user_activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 10. Triggers để log activity
CREATE OR REPLACE FUNCTION log_user_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_activity_logs (user_id, action, resource_type, resource_id, details)
    VALUES (
        auth.uid(),
        TG_OP || '_' || TG_TABLE_NAME,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        row_to_json(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END)
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Áp dụng trigger cho các bảng quan trọng
CREATE TRIGGER log_project_activity
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION log_user_activity();

CREATE TRIGGER log_product_activity
    AFTER INSERT OR UPDATE OR DELETE ON products
    FOR EACH ROW EXECUTE FUNCTION log_user_activity();

CREATE TRIGGER log_member_activity
    AFTER INSERT OR UPDATE OR DELETE ON project_members
    FOR EACH ROW EXECUTE FUNCTION log_user_activity();