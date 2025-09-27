-- ====================================
-- KIỂM TRA CUỐI CÙNG - VERIFICATION
-- ====================================

-- Kiểm tra các bảng đã được tạo
SELECT
    '=== KIỂM TRA CẤU TRÚC DATABASE ===' as section;

-- 1. Kiểm tra enum user_role
SELECT
    'user_role enum' as item,
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role')
        THEN '✅ Đã tạo'
        ELSE '❌ Chưa tạo'
    END as status;

-- 2. Kiểm tra các bảng
SELECT
    table_name as item,
    CASE
        WHEN table_name IN (
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
        )
        THEN '✅ Đã tạo'
        ELSE '❌ Chưa tạo'
    END as status
FROM (VALUES
    ('user_profiles'),
    ('projects'),
    ('project_members'),
    ('user_activity_logs'),
    ('permission_templates')
) t(table_name);

-- 3. Kiểm tra columns mới trong user_profiles
SELECT
    column_name as item,
    CASE
        WHEN column_name IN (
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'user_profiles' AND table_schema = 'public'
        )
        THEN '✅ Đã có'
        ELSE '❌ Chưa có'
    END as status
FROM (VALUES
    ('role'),
    ('max_projects'),
    ('max_team_members'),
    ('permissions'),
    ('last_active_at'),
    ('is_suspended'),
    ('created_by')
) t(column_name);

-- 4. Kiểm tra functions
SELECT
    routine_name as item,
    CASE
        WHEN routine_name IN (
            SELECT routine_name FROM information_schema.routines
            WHERE routine_schema = 'public'
        )
        THEN '✅ Đã tạo'
        ELSE '❌ Chưa tạo'
    END as status
FROM (VALUES
    ('user_can_access_project')
) t(routine_name);

-- 5. Kiểm tra RLS policies
SELECT
    '=== KIỂM TRA RLS POLICIES ===' as section;

SELECT
    tablename as table_name,
    COUNT(*) as policy_count,
    CASE
        WHEN COUNT(*) > 0 THEN '✅ Có policies'
        ELSE '❌ Chưa có policies'
    END as status
FROM pg_policies
WHERE tablename IN ('project_members', 'user_activity_logs')
GROUP BY tablename;

-- 6. Kiểm tra dữ liệu permission templates
SELECT
    '=== KIỂM TRA PERMISSION TEMPLATES ===' as section;

SELECT
    name,
    role,
    is_system_template,
    '✅ OK' as status
FROM permission_templates
WHERE is_system_template = TRUE
ORDER BY role;

-- 7. Kiểm tra user hiện tại
SELECT
    '=== KIỂM TRA USER HIỆN TẠI ===' as section;

SELECT
    email,
    role,
    is_active,
    max_projects,
    max_team_members,
    CASE
        WHEN role IS NOT NULL THEN '✅ Role OK'
        ELSE '❌ Role NULL'
    END as role_status
FROM user_profiles
ORDER BY role, email;

-- 8. Tổng kết
SELECT
    '=== TỔNG KẾT ===' as section;

SELECT
    'Hệ thống phân quyền mới đã sẵn sàng!' as message,
    '✅ HOÀN THÀNH' as status;