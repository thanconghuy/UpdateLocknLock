-- ====================================
-- RECOVERY ENUM MIGRATION
-- Xử lý mọi trường hợp có thể - kể cả khi đã bị drop column
-- ====================================

-- BƯỚC 1: Kiểm tra trạng thái hiện tại
SELECT
    '=== KIỂM TRA COLUMNS HIỆN TẠI ===' as info,
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name LIKE '%role%'
ORDER BY column_name;

-- Kiểm tra enums hiện có
SELECT '=== ENUM HIỆN TẠI ===' as info;
SELECT typname as enum_name
FROM pg_type
WHERE typname LIKE '%role%'
AND typtype = 'e';

-- BƯỚC 2: Phân tích tình huống và phục hồi
DO $$
DECLARE
    has_role BOOLEAN;
    has_role_backup BOOLEAN;
    has_role_new BOOLEAN;
    has_role_v2 BOOLEAN;
    enum_exists BOOLEAN;
    enum_v2_exists BOOLEAN;
BEGIN
    -- Kiểm tra các columns tồn tại
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'role'
    ) INTO has_role;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'role_backup'
    ) INTO has_role_backup;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'role_new'
    ) INTO has_role_new;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'role_v2'
    ) INTO has_role_v2;

    -- Kiểm tra enums
    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'user_role'
    ) INTO enum_exists;

    SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'user_role_v2'
    ) INTO enum_v2_exists;

    RAISE NOTICE 'Status: role=%, role_backup=%, role_new=%, role_v2=%, enum=%, enum_v2=%',
        has_role, has_role_backup, has_role_new, has_role_v2, enum_exists, enum_v2_exists;

    -- TRƯỜNG HỢP 1: Column role bị mất nhưng có backup
    IF NOT has_role AND has_role_backup THEN
        RAISE NOTICE 'CASE 1: Recovering from role_backup';

        -- Tạo enum mới nếu chưa có
        IF NOT enum_v2_exists THEN
            CREATE TYPE user_role_v2 AS ENUM (
                'admin', 'manager', 'product_editor', 'project_viewer', 'viewer'
            );
        END IF;

        -- Tạo column role_v2 nếu chưa có
        IF NOT has_role_v2 THEN
            ALTER TABLE user_profiles ADD COLUMN role_v2 user_role_v2 DEFAULT 'viewer';
        END IF;

        -- Restore từ backup
        UPDATE user_profiles SET role_v2 =
            CASE
                WHEN role_backup = 'admin' THEN 'admin'::user_role_v2
                WHEN role_backup = 'manager' THEN 'manager'::user_role_v2
                WHEN role_backup IN ('editor', 'product_editor') THEN 'product_editor'::user_role_v2
                WHEN role_backup = 'project_viewer' THEN 'project_viewer'::user_role_v2
                ELSE 'viewer'::user_role_v2
            END;

    -- TRƯỜNG HỢP 2: Có role_v2 nhưng thiếu role chính
    ELSIF NOT has_role AND has_role_v2 THEN
        RAISE NOTICE 'CASE 2: role_v2 exists, need to finalize';
        -- Sẽ xử lý ở bước sau

    -- TRƯỜNG HỢP 3: Column role vẫn tồn tại - migration bình thường
    ELSIF has_role THEN
        RAISE NOTICE 'CASE 3: Normal migration needed';

        -- Clean up previous attempts
        IF has_role_new THEN
            DROP COLUMN role_new;
        END IF;
        IF has_role_v2 THEN
            DROP COLUMN role_v2;
        END IF;
        IF enum_v2_exists THEN
            DROP TYPE user_role_v2 CASCADE;
        END IF;

        -- Tạo backup nếu chưa có
        IF NOT has_role_backup THEN
            ALTER TABLE user_profiles ADD COLUMN role_backup TEXT;
            UPDATE user_profiles SET role_backup = role::TEXT;
        END IF;

        -- Tạo enum và column mới
        CREATE TYPE user_role_v2 AS ENUM (
            'admin', 'manager', 'product_editor', 'project_viewer', 'viewer'
        );

        ALTER TABLE user_profiles ADD COLUMN role_v2 user_role_v2 DEFAULT 'viewer';

        UPDATE user_profiles SET role_v2 =
            CASE
                WHEN role::TEXT = 'admin' THEN 'admin'::user_role_v2
                WHEN role::TEXT = 'manager' THEN 'manager'::user_role_v2
                WHEN role::TEXT IN ('editor', 'product_editor') THEN 'product_editor'::user_role_v2
                WHEN role::TEXT = 'project_viewer' THEN 'project_viewer'::user_role_v2
                ELSE 'viewer'::user_role_v2
            END;

    -- TRƯỜNG HỢP 4: Mất hết data
    ELSE
        RAISE NOTICE 'CASE 4: Complete data loss - creating fresh';

        -- Tạo enum v2 nếu chưa có
        IF NOT enum_v2_exists THEN
            CREATE TYPE user_role_v2 AS ENUM (
                'admin', 'manager', 'product_editor', 'project_viewer', 'viewer'
            );
        END IF;

        -- Tạo column mới với default admin cho user đầu tiên
        IF NOT has_role_v2 THEN
            ALTER TABLE user_profiles ADD COLUMN role_v2 user_role_v2 DEFAULT 'viewer';
            -- Set admin cho user đầu tiên
            UPDATE user_profiles SET role_v2 = 'admin'::user_role_v2
            WHERE id = (SELECT id FROM user_profiles ORDER BY created_at LIMIT 1);
        END IF;

        -- Tạo backup column
        IF NOT has_role_backup THEN
            ALTER TABLE user_profiles ADD COLUMN role_backup TEXT DEFAULT 'viewer';
            UPDATE user_profiles SET role_backup =
                CASE WHEN role_v2 = 'admin'::user_role_v2 THEN 'admin' ELSE 'viewer' END;
        END IF;
    END IF;

END $$;

-- BƯỚC 3: Hiển thị trạng thái sau recovery
SELECT
    '=== TRẠNG THÁI SAU RECOVERY ===' as info,
    id,
    email,
    role_backup,
    role_v2::TEXT as new_role
FROM user_profiles
ORDER BY created_at;

-- BƯỚC 4: Finalize migration (chỉ nếu có role_v2)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role_v2') THEN

        -- Disable RLS
        ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
        ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

        -- Drop old policies
        DROP POLICY IF EXISTS "Admins can manage all users" ON user_profiles;
        DROP POLICY IF EXISTS "Admin only access to system_settings" ON system_settings;
        DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
        DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

        -- Drop old enum if exists
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
            DROP TYPE user_role CASCADE;
        END IF;

        -- Rename enum and column
        ALTER TYPE user_role_v2 RENAME TO user_role;
        ALTER TABLE user_profiles RENAME COLUMN role_v2 TO role;

        -- Set constraints
        ALTER TABLE user_profiles ALTER COLUMN role SET NOT NULL;

        -- Create new policies
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

        CREATE POLICY "Admin only access to system_settings" ON system_settings
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM user_profiles up
                    WHERE up.id = auth.uid() AND up.role = 'admin'
                )
            );

        -- Enable RLS
        ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

        RAISE NOTICE 'Migration finalized successfully';
    ELSE
        RAISE NOTICE 'No role_v2 column found - migration may have failed';
    END IF;
END $$;

-- BƯỚC 5: Kết quả cuối cùng
SELECT
    '=== KẾT QUẢ CUỐI CÙNG ===' as info,
    id,
    email,
    role::TEXT as current_role,
    role_backup as original_backup,
    CASE
        WHEN role IS NOT NULL THEN '✅ SUCCESS'
        ELSE '❌ FAILED'
    END as migration_status
FROM user_profiles
ORDER BY created_at;

-- Hiển thị enum mới
SELECT '=== ENUM MỚI ===' as info;
SELECT unnest(enum_range(NULL::user_role)) as available_roles;

-- Clean up (uncomment khi đã ổn)
-- ALTER TABLE user_profiles DROP COLUMN IF EXISTS role_backup;

SELECT '🎉 RECOVERY MIGRATION COMPLETED!' as final_status;