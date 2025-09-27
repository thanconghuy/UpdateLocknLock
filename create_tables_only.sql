-- ==========================================================================
-- CREATE TABLES ONLY - SKIP ENUMS
-- ==========================================================================
-- Skip enums since they already exist, just create tables

-- Create user_profiles table
CREATE TABLE user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email varchar(255) UNIQUE NOT NULL,
    full_name varchar(255),
    avatar_url text,
    role user_role DEFAULT 'user' NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create projects table
CREATE TABLE projects (
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

-- Create project_members table
CREATE TABLE project_members (
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

-- Sync existing users to user_profiles
INSERT INTO user_profiles (id, email, full_name, role, is_active)
SELECT
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
    'user'::user_role,
    true
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM user_profiles up WHERE up.id = au.id);

-- Final verification
SELECT
    'TABLES CREATED SUCCESSFULLY!' as status,
    (SELECT COUNT(*) FROM user_profiles) as user_profiles_count,
    (SELECT COUNT(*) FROM projects) as projects_count,
    (SELECT COUNT(*) FROM project_members) as members_count;