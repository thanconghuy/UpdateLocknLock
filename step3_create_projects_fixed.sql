-- ==========================================================================
-- STEP 3: CREATE PROJECTS TABLE (FIXED)
-- ==========================================================================
-- Tạo bảng projects cho quản lý nhiều website
-- Script đã fix lỗi policy dependencies

-- 1. Create projects table first
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

RAISE NOTICE '✅ Projects table created successfully';

-- 2. Create project_members table
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

RAISE NOTICE '✅ Project members table created successfully';

-- 3. Create indexes for projects
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- 4. Create indexes for project_members
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_role ON project_members(role);
CREATE INDEX IF NOT EXISTS idx_project_members_active ON project_members(is_active);

RAISE NOTICE '✅ Indexes created successfully';

-- 5. Enable RLS on both tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- 6. Drop existing policies (if any)
DO $$
BEGIN
    -- Drop projects policies
    DROP POLICY IF EXISTS "Users can view own projects" ON projects;
    DROP POLICY IF EXISTS "Project owners can manage projects" ON projects;
    DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
    DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;
    DROP POLICY IF EXISTS "Project members can view projects" ON projects;

    -- Drop project_members policies
    DROP POLICY IF EXISTS "Users can view project members" ON project_members;
    DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;
    DROP POLICY IF EXISTS "Admins can view all members" ON project_members;
    DROP POLICY IF EXISTS "Admins can manage all members" ON project_members;

    RAISE NOTICE '✅ Old policies dropped successfully';
END $$;

-- 7. Create RLS policies for projects table
CREATE POLICY "Project owners can manage projects" ON projects
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Project members can view projects" ON projects
    FOR SELECT USING (
        owner_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_id = id
            AND user_id = auth.uid()
            AND is_active = true
        )
    );

CREATE POLICY "Admins can view all projects" ON projects
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
        )
    );

CREATE POLICY "Admins can manage all projects" ON projects
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
        )
    );

RAISE NOTICE '✅ Projects RLS policies created successfully';

-- 8. Create RLS policies for project_members table
CREATE POLICY "Users can view own membership" ON project_members
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Project owners can manage members" ON project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE id = project_id AND owner_id = auth.uid()
        )
    );

CREATE POLICY "Project admins can view members" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_id
            AND pm.user_id = auth.uid()
            AND pm.role IN ('owner', 'admin')
            AND pm.is_active = true
        )
    );

CREATE POLICY "Admins can view all members" ON project_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
        )
    );

CREATE POLICY "Admins can manage all members" ON project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
        )
    );

RAISE NOTICE '✅ Project members RLS policies created successfully';

-- 9. Create functions
-- Function to update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to auto add project owner as member
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

    RAISE NOTICE 'Added project owner as member for project: %', NEW.name;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to add project owner as member: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate unique slug
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

    -- Remove leading/trailing dashes
    base_slug := trim(base_slug, '-');

    -- If empty after cleanup, use default
    IF length(base_slug) = 0 THEN
        base_slug := 'project';
    END IF;

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

RAISE NOTICE '✅ Functions created successfully';

-- 10. Create triggers
DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_members_updated_at ON project_members;
CREATE TRIGGER update_project_members_updated_at
    BEFORE UPDATE ON project_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

RAISE NOTICE '✅ Triggers created successfully';

-- 11. Verification
SELECT
    '🎯 PROJECTS SYSTEM VERIFICATION:' as status,
    (
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
        END
    ) as projects_table,
    (
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_members')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
        END
    ) as project_members_table,
    (SELECT COUNT(*) FROM projects)::text as total_projects,
    (SELECT COUNT(*) FROM project_members)::text as total_members;

-- Show table columns
SELECT
    '📋 PROJECTS TABLE STRUCTURE:' as info,
    column_name,
    data_type,
    is_nullable,
    CASE
        WHEN column_default IS NOT NULL THEN substring(column_default, 1, 30)
        ELSE 'NULL'
    END as default_value
FROM information_schema.columns
WHERE table_name = 'projects'
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test slug generation function
SELECT
    '🧪 SLUG GENERATION TEST:' as test,
    generate_project_slug('My Test Project !!!') as test_slug_1,
    generate_project_slug('Shopee Website Management') as test_slug_2,
    generate_project_slug('TikTok Store @#$%') as test_slug_3;

RAISE NOTICE '🎉 Projects system setup completed successfully!';