-- ==========================================================================
-- MINIMAL DATABASE SETUP FOR PROJECT CREATION
-- ==========================================================================
-- Script đơn giản để tạo các bảng cần thiết cho project system
-- Run this in Supabase SQL Editor

-- 1. Create enums if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'user');
        RAISE NOTICE '✅ user_role enum created';
    ELSE
        RAISE NOTICE 'ℹ️ user_role enum already exists';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_member_role') THEN
        CREATE TYPE project_member_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
        RAISE NOTICE '✅ project_member_role enum created';
    ELSE
        RAISE NOTICE 'ℹ️ project_member_role enum already exists';
    END IF;
END $$;

-- 2. Create user_profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email varchar(255) UNIQUE NOT NULL,
    full_name varchar(255),
    avatar_url text,
    role user_role DEFAULT 'user'::user_role NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'user_profiles') THEN
        CREATE POLICY "Users can view own profile" ON user_profiles
            FOR SELECT USING (id = auth.uid());
        RAISE NOTICE '✅ user_profiles SELECT policy created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own profile' AND tablename = 'user_profiles') THEN
        CREATE POLICY "Users can update own profile" ON user_profiles
            FOR UPDATE USING (id = auth.uid());
        RAISE NOTICE '✅ user_profiles UPDATE policy created';
    END IF;
END $$;

-- 3. Create projects table if it doesn't exist
CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(255) NOT NULL,
    description text,
    slug varchar(100),
    owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    woocommerce_base_url varchar(500) NOT NULL,
    woocommerce_consumer_key varchar(255) NOT NULL,
    woocommerce_consumer_secret varchar(255) NOT NULL,
    products_table varchar(100) DEFAULT 'products',
    audit_table varchar(100) DEFAULT 'product_updates',
    settings jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS on projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Create policies for projects if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Project owners can manage projects' AND tablename = 'projects') THEN
        CREATE POLICY "Project owners can manage projects" ON projects
            FOR ALL USING (owner_id = auth.uid());
        RAISE NOTICE '✅ projects owner policy created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all projects' AND tablename = 'projects') THEN
        CREATE POLICY "Admins can manage all projects" ON projects
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM user_profiles
                    WHERE id = auth.uid() AND role = 'admin'::user_role AND is_active = true
                )
            );
        RAISE NOTICE '✅ projects admin policy created';
    END IF;
END $$;

-- 4. Create project_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS project_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role project_member_role DEFAULT 'viewer'::project_member_role NOT NULL,
    invited_by uuid REFERENCES auth.users(id),
    invited_at timestamptz DEFAULT now(),
    joined_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- Enable RLS on project_members
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Create policies for project_members if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own membership' AND tablename = 'project_members') THEN
        CREATE POLICY "Users can view own membership" ON project_members
            FOR SELECT USING (user_id = auth.uid());
        RAISE NOTICE '✅ project_members user policy created';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Project owners can manage members' AND tablename = 'project_members') THEN
        CREATE POLICY "Project owners can manage members" ON project_members
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM projects
                    WHERE id = project_id AND owner_id = auth.uid()
                )
            );
        RAISE NOTICE '✅ project_members owner policy created';
    END IF;
END $$;

-- 5. Create basic functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create function to auto add project owner as member
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

-- 6. Create triggers
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_members_updated_at ON project_members;
CREATE TRIGGER update_project_members_updated_at
    BEFORE UPDATE ON project_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- 8. Verification
SELECT
    'DATABASE VERIFICATION:' as status,
    (
        CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
        END
    ) as user_profiles_table,
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
    ) as project_members_table;

RAISE NOTICE '🎉 Minimal database setup completed successfully!';