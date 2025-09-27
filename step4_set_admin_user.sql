-- ==========================================================================
-- STEP 4: SET ADMIN USER
-- ==========================================================================
-- Set user cụ thể thành admin
-- Chạy sau khi hoàn thành step3_create_projects.sql

-- ⚠️ THAY ĐỔI EMAIL DƯỚI ĐÂY THÀNH EMAIL CỦA BẠN
DO $$
DECLARE
    target_email varchar(255) := 'vtphong91@gmail.com';  -- 🔴 THAY ĐỔI EMAIL NÀY
    user_exists boolean := false;
    auth_user_id uuid;
    profile_exists boolean := false;
BEGIN
    RAISE NOTICE 'Setting up admin user for email: %', target_email;

    -- 1. Kiểm tra user có tồn tại trong auth.users không
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE email = target_email
    ), id INTO user_exists, auth_user_id
    FROM auth.users WHERE email = target_email;

    IF NOT user_exists THEN
        RAISE NOTICE '❌ User with email % does not exist in auth.users', target_email;
        RAISE NOTICE '📝 Please register this email first, then run this script again';
        RETURN;
    END IF;

    RAISE NOTICE '✅ Found user in auth.users with ID: %', auth_user_id;

    -- 2. Kiểm tra user profile có tồn tại không
    SELECT EXISTS (
        SELECT 1 FROM user_profiles WHERE id = auth_user_id
    ) INTO profile_exists;

    IF profile_exists THEN
        RAISE NOTICE '📝 User profile exists, updating role to admin...';

        -- Update existing profile
        UPDATE user_profiles
        SET
            role = 'admin'::user_role,
            is_active = true,
            updated_at = now()
        WHERE id = auth_user_id;

        RAISE NOTICE '✅ Updated existing user profile to admin';
    ELSE
        RAISE NOTICE '📝 User profile does not exist, creating new admin profile...';

        -- Create new admin profile
        INSERT INTO user_profiles (
            id,
            email,
            full_name,
            role,
            is_active
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
            true
        FROM auth.users au
        WHERE au.id = auth_user_id;

        RAISE NOTICE '✅ Created new admin user profile';
    END IF;

    RAISE NOTICE '🎉 Successfully set % as admin user!', target_email;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Error setting admin user: %', SQLERRM;
        RAISE NOTICE '🔧 Details: %', SQLSTATE;
END $$;

-- Verification - Show admin user details
SELECT
    '🎯 ADMIN USER SETUP RESULT:' as status,
    up.email,
    up.full_name,
    up.role::text,
    up.is_active,
    CASE
        WHEN au.email_confirmed_at IS NOT NULL THEN '✅ Email Verified'
        ELSE '⚠️ Email Not Verified'
    END as email_status,
    up.created_at,
    up.updated_at
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE up.email = 'vtphong91@gmail.com'  -- 🔴 THAY ĐỔI EMAIL NÀY CHO GIỐNG TRÊN
   OR up.role = 'admin'::user_role
ORDER BY up.role DESC, up.created_at;

-- Show all users in system
SELECT
    '👥 ALL USERS IN SYSTEM:' as info,
    up.email,
    up.full_name,
    up.role::text as system_role,
    up.is_active,
    CASE
        WHEN au.email_confirmed_at IS NOT NULL THEN '✅'
        ELSE '⚠️'
    END as verified
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
ORDER BY up.role, up.created_at;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM user_profiles
        WHERE id = check_user_id
        AND role = 'admin'::user_role
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Test admin function
SELECT
    '🧪 ADMIN FUNCTION TEST:' as test_result,
    up.email,
    is_admin(up.id)::text as is_admin_result
FROM user_profiles up
WHERE up.role = 'admin'::user_role
LIMIT 1;