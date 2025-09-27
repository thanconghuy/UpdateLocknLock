-- ==========================================================================
-- SETUP USER PROFILE TRIGGER
-- ==========================================================================
-- Script để tạo trigger tự động tạo user_profile khi user đăng ký
-- Run this in Supabase SQL Editor after running database_setup_minimal.sql

-- Create function to handle new user registration
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

-- Create function to handle existing users (run once)
CREATE OR REPLACE FUNCTION sync_existing_users()
RETURNS void AS $$
DECLARE
    user_record RECORD;
    profile_count INTEGER;
BEGIN
    -- Check existing users and create profiles if missing
    FOR user_record IN
        SELECT au.id, au.email, au.raw_user_meta_data
        FROM auth.users au
        LEFT JOIN user_profiles up ON au.id = up.id
        WHERE up.id IS NULL
    LOOP
        BEGIN
            INSERT INTO user_profiles (
                id,
                email,
                full_name,
                role,
                is_active
            )
            VALUES (
                user_record.id,
                user_record.email,
                COALESCE(
                    user_record.raw_user_meta_data->>'full_name',
                    user_record.raw_user_meta_data->>'display_name',
                    split_part(user_record.email, '@', 1)
                ),
                'user'::user_role,
                true
            );

            RAISE NOTICE 'Created profile for existing user: %', user_record.email;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to create profile for existing user %: %', user_record.email, SQLERRM;
        END;
    END LOOP;

    -- Get final count
    SELECT COUNT(*) INTO profile_count FROM user_profiles;
    RAISE NOTICE 'Total user profiles: %', profile_count;
END;
$$ LANGUAGE plpgsql;

-- Run sync for existing users
SELECT sync_existing_users();

-- Verification
SELECT
    'USER PROFILE SYNC VERIFICATION:' as status,
    (SELECT COUNT(*) FROM auth.users)::text as total_auth_users,
    (SELECT COUNT(*) FROM user_profiles)::text as total_user_profiles,
    (
        CASE WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM user_profiles)
        THEN '✅ SYNCED'
        ELSE '❌ MISMATCHED'
        END
    ) as sync_status;

-- Show user profiles
SELECT
    'CURRENT USER PROFILES:' as info,
    up.email,
    up.full_name,
    up.role::text,
    up.is_active
FROM user_profiles up
ORDER BY up.created_at;

RAISE NOTICE '🎉 User profile sync completed successfully!';