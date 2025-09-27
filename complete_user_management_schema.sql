-- ==========================================================================
-- COMPLETE USER MANAGEMENT & AUTHORIZATION SYSTEM
-- ==========================================================================
-- Tạo hệ thống quản lý user profile và phân quyền hoàn chỉnh
-- Chạy script này trong Supabase SQL Editor

-- ==========================================================================
-- 1. ENUMS - Định nghĩa các loại dữ liệu
-- ==========================================================================

-- User roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'admin',        -- Quản trị hệ thống
        'manager',      -- Quản lý projects
        'editor',       -- Chỉnh sửa sản phẩm
        'viewer'        -- Chỉ xem
    );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'user_role enum already exists';
END $$;

-- Project member roles
DO $$ BEGIN
    CREATE TYPE project_member_role AS ENUM (
        'owner',        -- Chủ sở hữu project
        'admin',        -- Admin của project
        'editor',       -- Editor của project
        'viewer'        -- Viewer của project
    );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'project_member_role enum already exists';
END $$;

-- Activity types for audit log
DO $$ BEGIN
    CREATE TYPE activity_type AS ENUM (
        'login',
        'logout',
        'create_project',
        'update_project',
        'delete_project',
        'add_user_to_project',
        'remove_user_from_project',
        'update_user_role',
        'product_create',
        'product_update',
        'product_delete',
        'data_import',
        'data_export',
        'settings_change'
    );
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'activity_type enum already exists';
END $$;

-- ==========================================================================
-- 2. TABLES - Tạo các bảng chính
-- ==========================================================================

-- 2.1 User Profiles - Thông tin chi tiết user
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email varchar(255) UNIQUE NOT NULL,
    full_name varchar(255),
    avatar_url text,
    phone varchar(20),
    company varchar(255),
    job_title varchar(255),

    -- System fields
    role user_role DEFAULT 'viewer'::user_role NOT NULL,
    is_active boolean DEFAULT true,
    last_login_at timestamptz,
    email_verified boolean DEFAULT false,

    -- Preferences
    language varchar(10) DEFAULT 'vi',
    timezone varchar(50) DEFAULT 'Asia/Ho_Chi_Minh',
    notification_preferences jsonb DEFAULT '{"email": true, "push": false}',

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id)
);

-- 2.2 Projects - Quản lý các dự án/website
CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    description text,
    slug varchar(100) UNIQUE,

    -- Owner information
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- WooCommerce Configuration
    woocommerce_base_url varchar(500) NOT NULL,
    woocommerce_consumer_key varchar(255) NOT NULL,
    woocommerce_consumer_secret varchar(255) NOT NULL,

    -- Database Configuration
    supabase_url varchar(500),
    supabase_anon_key varchar(500),
    products_table varchar(100) DEFAULT 'products',
    audit_table varchar(100) DEFAULT 'product_updates',

    -- Project Settings
    settings jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id)
);

-- 2.3 Project Members - Quản lý thành viên trong project
CREATE TABLE IF NOT EXISTS project_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role in project
    role project_member_role DEFAULT 'viewer'::project_member_role NOT NULL,

    -- Permissions override (optional)
    custom_permissions jsonb,

    -- Invitation info
    invited_by uuid REFERENCES auth.users(id),
    invited_at timestamptz DEFAULT now(),
    joined_at timestamptz,

    -- Status
    is_active boolean DEFAULT true,

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    -- Constraints
    UNIQUE(project_id, user_id)
);

-- 2.4 Permissions - Định nghĩa các quyền hạn
CREATE TABLE IF NOT EXISTS permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) UNIQUE NOT NULL,
    description text,
    category varchar(50), -- 'project', 'user', 'system', 'product'

    created_at timestamptz DEFAULT now()
);

-- 2.5 Role Permissions - Mapping roles với permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_type varchar(50) NOT NULL, -- 'user_role' hoặc 'project_member_role'
    role_name varchar(50) NOT NULL, -- tên của role
    permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,

    created_at timestamptz DEFAULT now(),

    UNIQUE(role_type, role_name, permission_id)
);

-- 2.6 User Activity Logs - Audit trail
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id uuid REFERENCES projects(id) ON DELETE SET NULL,

    -- Activity details
    activity_type activity_type NOT NULL,
    description text,
    metadata jsonb,

    -- Request info
    ip_address inet,
    user_agent text,

    -- Timestamps
    created_at timestamptz DEFAULT now()
);

-- 2.7 User Sessions - Quản lý phiên đăng nhập
CREATE TABLE IF NOT EXISTS user_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Session info
    session_token varchar(255) UNIQUE,
    refresh_token varchar(255),
    device_info jsonb,
    ip_address inet,
    user_agent text,

    -- Status
    is_active boolean DEFAULT true,
    expires_at timestamptz,
    last_activity_at timestamptz DEFAULT now(),

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==========================================================================
-- 3. INDEXES - Tối ưu hiệu suất
-- ==========================================================================

-- User Profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_login ON user_profiles(last_login_at);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- Project Members indexes
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
CREATE INDEX IF NOT EXISTS idx_project_members_active ON project_members(is_active);

-- Activity Logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project ON user_activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON user_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON user_activity_logs(created_at);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- ==========================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all existing policies for our tables
    FOR policy_record IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE tablename IN ('user_profiles', 'projects', 'project_members', 'permissions', 'role_permissions', 'user_activity_logs', 'user_sessions')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
    END LOOP;
END $$;

-- 4.1 User Profiles Policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage all users" ON user_profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4.2 Projects Policies
CREATE POLICY "Users can view own projects" ON projects
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = id AND user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Project owners can manage projects" ON projects
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all projects" ON projects
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4.3 Project Members Policies
CREATE POLICY "Users can view project members" ON project_members
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM projects
            WHERE id = project_id AND owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Project owners can manage members" ON project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
    );

-- 4.4 Activity Logs Policies
CREATE POLICY "Users can view own activity" ON user_activity_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can view all activity" ON user_activity_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4.5 Sessions Policies
CREATE POLICY "Users can manage own sessions" ON user_sessions
    FOR ALL USING (user_id = auth.uid());

-- 4.6 Permissions (Public read for system)
CREATE POLICY "Anyone can view permissions" ON permissions FOR SELECT USING (true);
CREATE POLICY "Anyone can view role permissions" ON role_permissions FOR SELECT USING (true);

-- ==========================================================================
-- 5. FUNCTIONS & TRIGGERS
-- ==========================================================================

-- 5.1 Function: Auto create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        role,
        email_verified,
        created_by
    )
    VALUES (
        new.id,
        new.email,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'display_name',
            split_part(new.email, '@', 1)
        ),
        'viewer'::user_role,
        new.email_confirmed_at IS NOT NULL,
        new.id
    );
    RETURN new;
EXCEPTION
    WHEN unique_violation THEN
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 Function: Update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.3 Function: Log user activity
CREATE OR REPLACE FUNCTION public.log_user_activity(
    p_user_id uuid,
    p_activity_type activity_type,
    p_description text DEFAULT NULL,
    p_metadata jsonb DEFAULT NULL,
    p_project_id uuid DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO user_activity_logs (
        user_id,
        project_id,
        activity_type,
        description,
        metadata,
        ip_address,
        user_agent
    )
    VALUES (
        p_user_id,
        p_project_id,
        p_activity_type,
        p_description,
        p_metadata,
        inet_client_addr(),
        current_setting('request.headers', true)::json->>'user-agent'
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Log errors but don't fail the main operation
        RAISE WARNING 'Failed to log activity: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.4 Function: Auto add project owner as member
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS trigger AS $$
BEGIN
    -- Add project owner as project member with owner role
    INSERT INTO project_members (
        project_id,
        user_id,
        role,
        invited_by,
        joined_at,
        is_active
    )
    VALUES (
        NEW.id,
        NEW.owner_id,
        'owner'::project_member_role,
        NEW.created_by,
        now(),
        true
    );

    -- Log activity
    PERFORM log_user_activity(
        NEW.owner_id,
        'create_project'::activity_type,
        'Created new project: ' || NEW.name,
        json_build_object('project_id', NEW.id, 'project_name', NEW.name)::jsonb,
        NEW.id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================================================
-- 6. TRIGGERS
-- ==========================================================================

-- Auto create user profile trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto update timestamps
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_members_updated_at ON project_members;
CREATE TRIGGER update_project_members_updated_at
    BEFORE UPDATE ON project_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto add project owner as member
DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- ==========================================================================
-- 7. DEFAULT PERMISSIONS DATA
-- ==========================================================================

-- Insert default permissions
INSERT INTO permissions (name, description, category) VALUES
-- System permissions
('system.admin', 'Full system administration', 'system'),
('system.users.manage', 'Manage system users', 'system'),
('system.settings.manage', 'Manage system settings', 'system'),

-- Project permissions
('project.create', 'Create new projects', 'project'),
('project.view', 'View project details', 'project'),
('project.edit', 'Edit project settings', 'project'),
('project.delete', 'Delete projects', 'project'),
('project.members.manage', 'Manage project members', 'project'),

-- Product permissions
('product.view', 'View products', 'product'),
('product.create', 'Create new products', 'product'),
('product.edit', 'Edit existing products', 'product'),
('product.delete', 'Delete products', 'product'),
('product.import', 'Import product data', 'product'),
('product.export', 'Export product data', 'product'),

-- User permissions
('user.profile.view', 'View user profiles', 'user'),
('user.profile.edit', 'Edit user profiles', 'user')

ON CONFLICT (name) DO NOTHING;

-- Map permissions to roles
WITH role_permission_mappings AS (
    SELECT * FROM (VALUES
        -- Admin permissions (full access)
        ('user_role', 'admin', 'system.admin'),
        ('user_role', 'admin', 'system.users.manage'),
        ('user_role', 'admin', 'system.settings.manage'),
        ('user_role', 'admin', 'project.create'),
        ('user_role', 'admin', 'project.view'),
        ('user_role', 'admin', 'project.edit'),
        ('user_role', 'admin', 'project.delete'),
        ('user_role', 'admin', 'project.members.manage'),
        ('user_role', 'admin', 'product.view'),
        ('user_role', 'admin', 'product.create'),
        ('user_role', 'admin', 'product.edit'),
        ('user_role', 'admin', 'product.delete'),
        ('user_role', 'admin', 'product.import'),
        ('user_role', 'admin', 'product.export'),
        ('user_role', 'admin', 'user.profile.view'),
        ('user_role', 'admin', 'user.profile.edit'),

        -- Manager permissions
        ('user_role', 'manager', 'project.create'),
        ('user_role', 'manager', 'project.view'),
        ('user_role', 'manager', 'project.edit'),
        ('user_role', 'manager', 'project.delete'),
        ('user_role', 'manager', 'project.members.manage'),
        ('user_role', 'manager', 'product.view'),
        ('user_role', 'manager', 'product.create'),
        ('user_role', 'manager', 'product.edit'),
        ('user_role', 'manager', 'product.delete'),
        ('user_role', 'manager', 'product.import'),
        ('user_role', 'manager', 'product.export'),
        ('user_role', 'manager', 'user.profile.view'),
        ('user_role', 'manager', 'user.profile.edit'),

        -- Editor permissions
        ('user_role', 'editor', 'project.view'),
        ('user_role', 'editor', 'product.view'),
        ('user_role', 'editor', 'product.create'),
        ('user_role', 'editor', 'product.edit'),
        ('user_role', 'editor', 'product.import'),
        ('user_role', 'editor', 'product.export'),
        ('user_role', 'editor', 'user.profile.view'),
        ('user_role', 'editor', 'user.profile.edit'),

        -- Viewer permissions
        ('user_role', 'viewer', 'project.view'),
        ('user_role', 'viewer', 'product.view'),
        ('user_role', 'viewer', 'user.profile.view'),
        ('user_role', 'viewer', 'user.profile.edit'),

        -- Project member role permissions
        ('project_member_role', 'owner', 'project.view'),
        ('project_member_role', 'owner', 'project.edit'),
        ('project_member_role', 'owner', 'project.delete'),
        ('project_member_role', 'owner', 'project.members.manage'),
        ('project_member_role', 'owner', 'product.view'),
        ('project_member_role', 'owner', 'product.create'),
        ('project_member_role', 'owner', 'product.edit'),
        ('project_member_role', 'owner', 'product.delete'),
        ('project_member_role', 'owner', 'product.import'),
        ('project_member_role', 'owner', 'product.export'),

        ('project_member_role', 'admin', 'project.view'),
        ('project_member_role', 'admin', 'project.edit'),
        ('project_member_role', 'admin', 'project.members.manage'),
        ('project_member_role', 'admin', 'product.view'),
        ('project_member_role', 'admin', 'product.create'),
        ('project_member_role', 'admin', 'product.edit'),
        ('project_member_role', 'admin', 'product.delete'),
        ('project_member_role', 'admin', 'product.import'),
        ('project_member_role', 'admin', 'product.export'),

        ('project_member_role', 'editor', 'project.view'),
        ('project_member_role', 'editor', 'product.view'),
        ('project_member_role', 'editor', 'product.create'),
        ('project_member_role', 'editor', 'product.edit'),
        ('project_member_role', 'editor', 'product.import'),
        ('project_member_role', 'editor', 'product.export'),

        ('project_member_role', 'viewer', 'project.view'),
        ('project_member_role', 'viewer', 'product.view')
    ) AS t(role_type, role_name, permission_name)
)
INSERT INTO role_permissions (role_type, role_name, permission_id)
SELECT
    rpm.role_type,
    rpm.role_name,
    p.id
FROM role_permission_mappings rpm
JOIN permissions p ON p.name = rpm.permission_name
ON CONFLICT (role_type, role_name, permission_id) DO NOTHING;

-- ==========================================================================
-- 8. SAMPLE DATA & VERIFICATION
-- ==========================================================================

-- Create profiles for existing users (if any)
INSERT INTO user_profiles (id, email, full_name, role, created_by)
SELECT
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'display_name',
        split_part(au.email, '@', 1)
    ),
    'viewer'::user_role,
    au.id
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles up WHERE up.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- ==========================================================================
-- 9. VERIFICATION QUERIES
-- ==========================================================================

-- Display setup summary
SELECT
    'User Management System Setup Complete!' as status,
    (SELECT COUNT(*) FROM user_profiles) as total_users,
    (SELECT COUNT(*) FROM projects) as total_projects,
    (SELECT COUNT(*) FROM permissions) as total_permissions,
    (SELECT COUNT(*) FROM role_permissions) as total_role_permissions;

-- Display all users with their roles
SELECT
    email,
    full_name,
    role,
    is_active,
    created_at
FROM user_profiles
ORDER BY created_at;