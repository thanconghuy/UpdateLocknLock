-- ==========================================================================
-- CREATE MISSING TABLES AND RELATIONSHIPS
-- ==========================================================================
-- Create all required tables with proper relationships
-- Run this in Supabase SQL Editor

-- 1. Create enums first
CREATE TYPE IF NOT EXISTS user_role AS ENUM ('admin', 'user');
CREATE TYPE IF NOT EXISTS project_member_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- 2. Create user_profiles table with proper structure
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

-- 3. Create projects table
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

-- 4. Create project_members table with CORRECT foreign keys
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

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_active ON project_members(is_active);

-- 6. Create functions
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

-- 7. Create triggers
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

DROP TRIGGER IF EXISTS on_project_created ON projects;
CREATE TRIGGER on_project_created
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- 8. Create function to handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    -- Create user profile with data from auth.users
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        role,
        is_active
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
        'user'::user_role,
        true
    );

    RAISE NOTICE 'Created user profile for: %', NEW.email;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to create user profile for %: %', NEW.email, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Sync existing users
INSERT INTO user_profiles (id, email, full_name, role, is_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)),
    'user'::user_role,
    true
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = au.id);

-- 10. Verification
SELECT
    'DATABASE SETUP VERIFICATION:' as status,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'user_profiles')::text as user_profiles_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'projects')::text as projects_exists,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'project_members')::text as project_members_exists,
    (SELECT COUNT(*) FROM auth.users)::text as auth_users_count,
    (SELECT COUNT(*) FROM user_profiles)::text as user_profiles_count;

-- Show foreign key relationships
SELECT
    'FOREIGN KEY VERIFICATION:' as info,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name IN ('user_profiles', 'projects', 'project_members')
ORDER BY tc.table_name, kcu.column_name;

RAISE NOTICE '🎉 Database setup completed successfully!';