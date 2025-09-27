-- ==========================================================================
-- STEP 3: CREATE PROJECTS TABLE
-- ==========================================================================
-- Tạo bảng projects cho quản lý nhiều website
-- Chạy sau khi hoàn thành step2_create_user_profiles.sql

-- 1. Create projects table
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
    products_table varchar(100) DEFAULT 'products',
    audit_table varchar(100) DEFAULT 'product_updates',

    -- Project Settings
    settings jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- 3. Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Project owners can manage projects" ON projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;

-- 5. Create RLS policies
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
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role
        )
    );

CREATE POLICY "Admins can manage all projects" ON projects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role
        )
    );

-- 6. Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Role in project
    role project_member_role DEFAULT 'viewer'::project_member_role NOT NULL,

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

-- 7. Create indexes for project_members
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
CREATE INDEX IF NOT EXISTS idx_project_members_active ON project_members(is_active);

-- 8. Enable RLS for project_members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- 9. Create policies for project_members
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

-- 10. Function to auto add project owner as member
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
        NEW.owner_id,
        now(),
        true
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create trigger for new projects
DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- 12. Create update timestamp trigger for projects
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. Create update timestamp trigger for project_members
DROP TRIGGER IF EXISTS update_project_members_updated_at ON project_members;
CREATE TRIGGER update_project_members_updated_at
    BEFORE UPDATE ON project_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. Function to generate unique slug
CREATE OR REPLACE FUNCTION generate_project_slug(project_name text, project_id uuid DEFAULT NULL)
RETURNS text AS $$
DECLARE
    base_slug text;
    final_slug text;
    counter integer := 0;
BEGIN
    -- Create base slug from name
    base_slug := lower(regexp_replace(trim(project_name), '[^a-zA-Z0-9\s]', '', 'g'));
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := substring(base_slug, 1, 50);

    final_slug := base_slug;

    -- Check for uniqueness
    WHILE EXISTS (
        SELECT 1 FROM projects
        WHERE slug = final_slug
        AND (project_id IS NULL OR id != project_id)
    ) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;

    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- 15. Verification
SELECT
    'PROJECTS SYSTEM CREATED:' as status,
    (SELECT COUNT(*) FROM projects)::text as total_projects,
    (SELECT COUNT(*) FROM project_members)::text as total_members;

-- Show table structure
SELECT
    'PROJECTS TABLE COLUMNS:' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'projects'
    AND table_schema = 'public'
ORDER BY ordinal_position;