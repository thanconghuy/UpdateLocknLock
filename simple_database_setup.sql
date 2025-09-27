-- ==========================================================================
-- SIMPLE DATABASE SETUP - COMPATIBLE WITH SUPABASE
-- ==========================================================================
-- Create all required tables step by step
-- Run this in Supabase SQL Editor

-- 1. Create enums (ignore error if they exist)
DO $$
BEGIN
    -- Create user_role enum
    BEGIN
        CREATE TYPE user_role AS ENUM ('admin', 'user');
        RAISE NOTICE '✅ user_role enum created';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'ℹ️ user_role enum already exists';
    END;

    -- Create project_member_role enum
    BEGIN
        CREATE TYPE project_member_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
        RAISE NOTICE '✅ project_member_role enum created';
    EXCEPTION
        WHEN duplicate_object THEN
            RAISE NOTICE 'ℹ️ project_member_role enum already exists';
    END;
END $$;

-- 2. Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email varchar(255) UNIQUE NOT NULL,
    full_name varchar(255),
    avatar_url text,
    role user_role DEFAULT 'user' NOT NULL,
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

-- 4. Create project_members table
CREATE TABLE IF NOT EXISTS project_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role project_member_role DEFAULT 'viewer' NOT NULL,
    invited_by uuid REFERENCES auth.users(id),
    invited_at timestamptz DEFAULT now(),
    joined_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- 5. Create basic indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- 6. Sync existing users to user_profiles
INSERT INTO user_profiles (id, email, full_name, role, is_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    'user'::user_role,
    true
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = au.id)
ON CONFLICT (id) DO NOTHING;

-- 7. Simple verification
SELECT
    'SETUP VERIFICATION:' as status,
    (SELECT COUNT(*) FROM user_profiles)::text as user_profiles_count,
    (SELECT COUNT(*) FROM projects)::text as projects_count,
    (SELECT COUNT(*) FROM project_members)::text as members_count;

-- 8. Show table structure
SELECT
    'TABLE STRUCTURE:' as info,
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('user_profiles', 'projects', 'project_members')
ORDER BY table_name, ordinal_position;