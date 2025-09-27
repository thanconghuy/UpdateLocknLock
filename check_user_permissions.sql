-- 1. Kiểm tra quyền của bảng user_profiles
SELECT
    grantee,
    privilege_type,
    is_grantable,
    grantor
FROM information_schema.role_table_grants
WHERE table_name = 'user_profiles'
ORDER BY grantee, privilege_type;

-- 2. Kiểm tra RLS policies của user_profiles
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'user_profiles';

-- 3. Kiểm tra xem RLS có được bật không
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'user_profiles';

-- 4. Kiểm tra cấu trúc bảng user_profiles
\d user_profiles;

-- 5. Kiểm tra dữ liệu hiện tại (nếu có quyền)
SELECT id, email, role, is_active, created_at
FROM user_profiles
ORDER BY created_at DESC
LIMIT 10;

-- 6. Kiểm tra user hiện tại và quyền
SELECT
    current_user as current_database_user,
    session_user,
    current_database(),
    current_schema();

-- 7. Kiểm tra auth user hiện tại (Supabase specific)
SELECT auth.uid() as current_auth_user_id;

-- 8. Kiểm tra xem có thể truy cập user_profiles không
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM user_profiles LIMIT 1)
        THEN 'CAN ACCESS user_profiles'
        ELSE 'CANNOT ACCESS user_profiles'
    END as access_status;

-- 9. Kiểm tra các constraint và triggers
SELECT
    constraint_name,
    constraint_type,
    table_name,
    column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'user_profiles';

-- 10. Kiểm tra tất cả bảng có quyền truy cập
SELECT
    table_schema,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = current_user
ORDER BY table_schema, table_name;