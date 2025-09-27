-- ====================================
-- FINALIZE MIGRATION - HOÀN TẤT MIGRATION
-- Column role đã dùng user_role_new, chỉ cần rename
-- ====================================

-- BƯỚC 1: Kiểm tra trạng thái hiện tại
SELECT
    '=== TRẠNG THÁI HIỆN TẠI ===' as info,
    column_name,
    udt_name as type_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name LIKE '%role%'
ORDER BY column_name;

-- BƯỚC 2: Kiểm tra enum hiện tại
SELECT
    '=== ENUM HIỆN TẠI ===' as info,
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE typname LIKE '%role%'
GROUP BY typname;

-- BƯỚC 3: Kiểm tra dữ liệu
SELECT
    '=== SAMPLE DATA ===' as info,
    email,
    role::TEXT as current_role
FROM user_profiles
ORDER BY created_at
LIMIT 3;

-- BƯỚC 4: Finalize migration - Rename enum
DO $$
BEGIN
    -- Kiểm tra xem user_role_new có tồn tại không
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_new') THEN
        RAISE NOTICE 'Found user_role_new, proceeding with finalization...';

        -- Disable RLS trước khi update policies
        ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

        -- Disable RLS cho system_settings nếu tồn tại
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
            ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;
        END IF;

        -- Drop old policies
        DROP POLICY IF EXISTS "Admins can manage all users" ON user_profiles;
        DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
        DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
            DROP POLICY IF EXISTS "Admin only access to system_settings" ON system_settings;
        END IF;

        -- Drop old user_role enum nếu tồn tại
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
            DROP TYPE user_role CASCADE;
            RAISE NOTICE 'Dropped old user_role type';
        END IF;

        -- Rename user_role_new thành user_role
        ALTER TYPE user_role_new RENAME TO user_role;
        RAISE NOTICE 'Renamed user_role_new to user_role';

        -- Tạo lại policies với enum mới
        CREATE POLICY "Users can view their own profile" ON user_profiles
            FOR SELECT USING (auth.uid() = id);

        CREATE POLICY "Users can update their own profile" ON user_profiles
            FOR UPDATE USING (auth.uid() = id);

        CREATE POLICY "Admins can manage all users" ON user_profiles
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM user_profiles up
                    WHERE up.id = auth.uid() AND up.role = 'admin'
                )
            );

        -- Tạo policy cho system_settings nếu table tồn tại
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
            CREATE POLICY "Admin only access to system_settings" ON system_settings
                FOR ALL USING (
                    EXISTS (
                        SELECT 1 FROM user_profiles up
                        WHERE up.id = auth.uid() AND up.role = 'admin'
                    )
                );
        END IF;

        -- Enable lại RLS
        ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
            ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
        END IF;

        RAISE NOTICE 'Policies recreated and RLS enabled';

    ELSE
        RAISE NOTICE 'user_role_new not found - migration may already be complete';
    END IF;
END $$;

-- BƯỚC 5: Kiểm tra kết quả
SELECT
    '=== KẾT QUẢ SAU MIGRATION ===' as info,
    column_name,
    udt_name as type_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name = 'role';

-- BƯỚC 6: Hiển thị enum values mới
SELECT
    '=== ENUM VALUES ===' as info,
    unnest(enum_range(NULL::user_role)) as available_roles;

-- BƯỚC 7: Kiểm tra data
SELECT
    '=== DATA VALIDATION ===' as info,
    role::TEXT as role_value,
    COUNT(*) as user_count
FROM user_profiles
GROUP BY role::TEXT
ORDER BY role::TEXT;

-- BƯỚC 8: Clean up columns backup nếu có
DO $$
BEGIN
    -- Xóa role_backup column nếu tồn tại (sau khi đã kiểm tra migration thành công)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role_backup') THEN
        -- Comment out để user có thể uncomment sau khi kiểm tra
        -- ALTER TABLE user_profiles DROP COLUMN role_backup;
        RAISE NOTICE 'role_backup column still exists - you can drop it manually if migration is successful';
    END IF;
END $$;

SELECT '✅ FINALIZE MIGRATION COMPLETED!' as final_status;