-- ====================================
-- BƯỚC 3: TẠO CÁC BẢNG MỚI
-- ====================================

-- 3.1. Project Members Table
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'viewer',
    assigned_by UUID NOT NULL REFERENCES user_profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '{}',

    -- Constraints
    UNIQUE(project_id, user_id)
);

-- Indexes cho project_members
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
CREATE INDEX IF NOT EXISTS idx_project_members_active ON project_members(is_active);

-- 3.2. User Activity Logs
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes cho activity logs
CREATE INDEX IF NOT EXISTS idx_activity_user_time ON user_activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_action ON user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_resource ON user_activity_logs(resource_type, resource_id);

-- 3.3. Permission Templates
CREATE TABLE IF NOT EXISTS permission_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    role user_role NOT NULL,
    permissions JSONB NOT NULL,
    description TEXT,
    is_system_template BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES user_profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index cho permission templates
CREATE INDEX IF NOT EXISTS idx_permission_templates_role ON permission_templates(role);
CREATE INDEX IF NOT EXISTS idx_permission_templates_system ON permission_templates(is_system_template);

-- COMPLETED: ✅ Bước 3 hoàn thành
SELECT '✅ BƯỚC 3: Tạo bảng project_members, user_activity_logs, permission_templates - HOÀN THÀNH' as status;