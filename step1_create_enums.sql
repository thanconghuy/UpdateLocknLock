-- ==========================================================================
-- STEP 1: CREATE ENUMS
-- ==========================================================================
-- Tạo các enum types cần thiết
-- Chạy script này trước tiên

-- 1. User roles enum
DO $$
BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'editor', 'viewer');
    RAISE NOTICE 'Created user_role enum successfully';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'user_role enum already exists, skipping...';
END $$;

-- 2. Project member roles enum
DO $$
BEGIN
    CREATE TYPE project_member_role AS ENUM ('owner', 'admin', 'editor', 'viewer');
    RAISE NOTICE 'Created project_member_role enum successfully';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'project_member_role enum already exists, skipping...';
END $$;

-- 3. Activity types enum
DO $$
BEGIN
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
    RAISE NOTICE 'Created activity_type enum successfully';
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'activity_type enum already exists, skipping...';
END $$;

-- Verification
SELECT
    'ENUMS CREATED:' as status,
    typname as enum_name,
    string_agg(enumlabel, ', ' ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
    AND typname IN ('user_role', 'project_member_role', 'activity_type')
GROUP BY typname
ORDER BY typname;