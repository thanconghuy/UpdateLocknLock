-- ==========================================================================
-- FIX RELATIONSHIPS AND FOREIGN KEYS
-- ==========================================================================
-- Fix foreign key relationships between tables

-- 1. Check current foreign keys
SELECT
    'CURRENT FOREIGN KEYS:' as info,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
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

-- 2. Drop project_members table and recreate with proper relationships
DROP TABLE IF EXISTS project_members CASCADE;

-- 3. Recreate project_members with explicit foreign keys to user_profiles
CREATE TABLE project_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    role project_member_role DEFAULT 'viewer' NOT NULL,
    invited_by uuid REFERENCES user_profiles(id),
    invited_at timestamptz DEFAULT now(),
    joined_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(project_id, user_id)
);

-- 4. Create indexes
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);
CREATE INDEX idx_project_members_active ON project_members(is_active);

-- 5. Verify relationships
SELECT
    'FIXED FOREIGN KEYS:' as info,
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
    AND tc.table_name = 'project_members'
ORDER BY kcu.column_name;

-- 6. Final verification
SELECT 'TABLES READY!' as status,
    (SELECT COUNT(*) FROM user_profiles) as users,
    (SELECT COUNT(*) FROM projects) as projects,
    (SELECT COUNT(*) FROM project_members) as members;