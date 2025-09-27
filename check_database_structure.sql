-- ==========================================================================
-- CHECK CURRENT DATABASE STRUCTURE
-- ==========================================================================
-- Script để kiểm tra cấu trúc database hiện tại
-- Chạy trong Supabase SQL Editor

-- 1. Kiểm tra các bảng hiện có
SELECT
    'EXISTING TABLES:' as info,
    '' as table_name,
    '' as table_type
UNION ALL
SELECT
    '',
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name NOT LIKE 'pg_%'
    AND table_name NOT LIKE 'information_schema%'
ORDER BY table_name;

-- 2. Kiểm tra các ENUM types hiện có
SELECT
    'EXISTING ENUMS:' as info,
    '' as enum_name,
    '' as enum_values
UNION ALL
SELECT
    '',
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY enum_name;

-- 3. Kiểm tra users hiện có trong auth.users
SELECT
    'EXISTING USERS IN AUTH:' as info,
    '' as email,
    '' as created_at,
    '' as email_confirmed
UNION ALL
SELECT
    '',
    email,
    created_at::text,
    CASE WHEN email_confirmed_at IS NOT NULL THEN 'Yes' ELSE 'No' END
FROM auth.users
ORDER BY created_at;

-- 4. Kiểm tra user_profiles nếu có
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        RAISE NOTICE 'user_profiles table exists, checking data...';

        -- Tạo temporary view để hiển thị
        CREATE OR REPLACE VIEW temp_user_profiles_check AS
        SELECT
            'EXISTING USER PROFILES:' as info,
            '' as email,
            '' as role,
            '' as is_active
        UNION ALL
        SELECT
            '',
            email,
            role::text,
            is_active::text
        FROM user_profiles
        ORDER BY email;

    ELSE
        RAISE NOTICE 'user_profiles table does not exist';
    END IF;
END $$;

-- Hiển thị user profiles nếu có
SELECT * FROM temp_user_profiles_check;

-- 5. Kiểm tra projects table nếu có
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects' AND table_schema = 'public') THEN
        RAISE NOTICE 'projects table exists, checking data...';

        CREATE OR REPLACE VIEW temp_projects_check AS
        SELECT
            'EXISTING PROJECTS:' as info,
            '' as name,
            '' as owner_email,
            '' as created_at
        UNION ALL
        SELECT
            '',
            p.name,
            up.email,
            p.created_at::text
        FROM projects p
        LEFT JOIN user_profiles up ON p.owner_id = up.id
        ORDER BY p.created_at;

    ELSE
        RAISE NOTICE 'projects table does not exist';
    END IF;
END $$;

-- Hiển thị projects nếu có
SELECT * FROM temp_projects_check;

-- 6. Tổng kết trạng thái database
SELECT
    'DATABASE STATUS SUMMARY:' as summary,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public')::text as total_tables,
    (SELECT COUNT(*) FROM auth.users)::text as total_auth_users,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as user_profiles_status,
    CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'projects')
        THEN 'EXISTS'
        ELSE 'MISSING'
    END as projects_status;

-- Cleanup
DROP VIEW IF EXISTS temp_user_profiles_check;
DROP VIEW IF EXISTS temp_projects_check;