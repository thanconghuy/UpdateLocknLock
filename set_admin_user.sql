-- ==========================================================================
-- SET ADMIN USER SCRIPT
-- ==========================================================================
-- Script để set user cụ thể thành admin sau khi đã chạy complete_user_management_schema.sql
-- Thay đổi email bên dưới thành email của bạn

-- ==========================================================================
-- 1. KIỂM TRA USER HIỆN TẠI
-- ==========================================================================

-- Xem tất cả users hiện tại
SELECT
    'Current Users in System:' as info,
    '' as email,
    '' as full_name,
    '' as current_role,
    '' as is_active,
    '' as email_verified
UNION ALL
SELECT
    '',
    up.email,
    up.full_name,
    up.role::text,
    up.is_active::text,
    CASE
        WHEN au.email_confirmed_at IS NOT NULL THEN 'Yes'
        ELSE 'No'
    END
FROM user_profiles up
LEFT JOIN auth.users au ON up.id = au.id
ORDER BY email;

-- ==========================================================================
-- 2. SET ADMIN ROLE
-- ==========================================================================

-- THAY ĐỔI EMAIL DƯỚI ĐÂY THÀNH EMAIL CỦA BẠN
DO $$
DECLARE
    target_email varchar(255) := 'vtphong91@gmail.com';  -- ⚠️ THAY ĐỔI EMAIL NÀY
    user_exists boolean := false;
    auth_user_id uuid;
BEGIN
    -- Kiểm tra user có tồn tại trong auth.users không
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE email = target_email
    ) INTO user_exists;

    IF NOT user_exists THEN
        RAISE NOTICE 'User with email % does not exist in auth.users. Please register first.', target_email;
        RETURN;
    END IF;

    -- Lấy user ID từ auth.users
    SELECT id INTO auth_user_id FROM auth.users WHERE email = target_email;

    -- Tạo hoặc update user profile
    INSERT INTO user_profiles (
        id,
        email,
        full_name,
        role,
        is_active,
        email_verified,
        created_by,
        updated_by
    )
    SELECT
        au.id,
        au.email,
        COALESCE(
            au.raw_user_meta_data->>'full_name',
            au.raw_user_meta_data->>'display_name',
            'Admin ' || split_part(au.email, '@', 1)
        ),
        'admin'::user_role,
        true,
        au.email_confirmed_at IS NOT NULL,
        au.id,
        au.id
    FROM auth.users au
    WHERE au.email = target_email
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin'::user_role,
        is_active = true,
        updated_at = now(),
        updated_by = auth_user_id;

    -- Log activity
    INSERT INTO user_activity_logs (
        user_id,
        activity_type,
        description,
        metadata
    )
    VALUES (
        auth_user_id,
        'update_user_role'::activity_type,
        'User role updated to admin',
        json_build_object(
            'old_role', 'viewer',
            'new_role', 'admin',
            'updated_by', 'system'
        )::jsonb
    );

    RAISE NOTICE 'Successfully set % as admin user!', target_email;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error setting admin user: %', SQLERRM;
END $$;

-- ==========================================================================
-- 3. VERIFICATION
-- ==========================================================================

-- Kiểm tra kết quả
SELECT
    'Admin User Setup Result:' as status,
    up.email,
    up.full_name,
    up.role,
    up.is_active,
    CASE
        WHEN au.email_confirmed_at IS NOT NULL THEN '✅ Verified'
        ELSE '⚠️ Not verified'
    END as email_status,
    up.created_at,
    up.updated_at
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE up.email = 'vtphong91@gmail.com'  -- ⚠️ THAY ĐỔI EMAIL NÀY CHO GIỐNG TRÊN
OR up.role = 'admin';

-- Hiển thị tất cả admins
SELECT
    'All Admin Users:' as info,
    email,
    full_name,
    role,
    is_active
FROM user_profiles
WHERE role = 'admin'
ORDER BY created_at;

-- Kiểm tra permissions của admin
SELECT
    'Admin Permissions:' as info,
    p.name as permission_name,
    p.description,
    p.category
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role_type = 'user_role' AND rp.role_name = 'admin'
ORDER BY p.category, p.name;

-- ==========================================================================
-- 4. ADDITIONAL ADMIN TOOLS
-- ==========================================================================

-- Function để kiểm tra user có quyền admin không
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_profiles
        WHERE id = user_id
        AND role = 'admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function để kiểm tra user có permission cụ thể không
CREATE OR REPLACE FUNCTION has_permission(user_id uuid, permission_name text)
RETURNS boolean AS $$
DECLARE
    user_system_role text;
BEGIN
    -- Lấy system role của user
    SELECT role::text INTO user_system_role
    FROM user_profiles
    WHERE id = user_id AND is_active = true;

    IF user_system_role IS NULL THEN
        RETURN false;
    END IF;

    -- Kiểm tra permission
    RETURN EXISTS (
        SELECT 1
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_type = 'user_role'
        AND rp.role_name = user_system_role
        AND p.name = permission_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test functions
SELECT
    'Permission Test:' as test,
    (SELECT email FROM user_profiles WHERE role = 'admin' LIMIT 1) as admin_email,
    is_admin((SELECT id FROM user_profiles WHERE role = 'admin' LIMIT 1)) as is_admin_result,
    has_permission((SELECT id FROM user_profiles WHERE role = 'admin' LIMIT 1), 'system.admin') as has_system_admin;