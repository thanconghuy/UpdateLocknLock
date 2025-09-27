-- ====================================
-- CLEAN ENUM MIGRATION - HOÀN TOÀN SẠCH
-- Xử lý mọi trường hợp có thể xảy ra
-- ====================================

-- BƯỚC 1: Kiểm tra trạng thái hiện tại
SELECT
    '=== TRẠNG THÁI HIỆN TẠI ===' as info,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_name = 'user_profiles'
AND column_name LIKE '%role%'
ORDER BY column_name;

-- Hiển thị các enum hiện có
SELECT '=== ENUM HIỆN TẠI ===' as info;
SELECT typname as enum_name
FROM pg_type
WHERE typname LIKE '%role%'
AND typtype = 'e';

-- BƯỚC 2: Clean up từ attempts trước (nếu có)
DO $$
BEGIN
    -- Xóa column tạm nếu tồn tại
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role_new') THEN
        ALTER TABLE user_profiles DROP COLUMN role_new;
        RAISE NOTICE 'Dropped existing role_new column';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'role_backup') THEN
        ALTER TABLE user_profiles DROP COLUMN role_backup;
        RAISE NOTICE 'Dropped existing role_backup column';
    END IF;

    -- Xóa enum tạm nếu tồn tại
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_new') THEN
        DROP TYPE user_role_new CASCADE;
        RAISE NOTICE 'Dropped existing user_role_new type';
    END IF;
END $$;

-- BƯỚC 3: Tạo enum mới với tên unique
CREATE TYPE user_role_v2 AS ENUM (
    'admin',           -- Toàn quyền hệ thống
    'manager',         -- Quản lý project và team
    'product_editor',  -- Chỉnh sửa sản phẩm
    'project_viewer',  -- Xem project (read-only)
    'viewer'          -- Xem cơ bản
);

-- BƯỚC 4: Thêm column backup TEXT
ALTER TABLE user_profiles ADD COLUMN role_backup TEXT;

-- BƯỚC 5: Backup dữ liệu hiện tại
UPDATE user_profiles SET role_backup = role::TEXT;

-- BƯỚC 6: Thêm column mới với enum v2
ALTER TABLE user_profiles ADD COLUMN role_v2 user_role_v2 DEFAULT 'viewer';

-- BƯỚC 7: Migrate dữ liệu
UPDATE user_profiles SET role_v2 =
    CASE
        WHEN role::TEXT = 'admin' THEN 'admin'::user_role_v2
        WHEN role::TEXT = 'manager' THEN 'manager'::user_role_v2
        WHEN role::TEXT = 'editor' THEN 'product_editor'::user_role_v2
        WHEN role::TEXT = 'product_editor' THEN 'product_editor'::user_role_v2
        WHEN role::TEXT = 'project_viewer' THEN 'project_viewer'::user_role_v2
        ELSE 'viewer'::user_role_v2
    END;

-- BƯỚC 8: Hiển thị kết quả migration
SELECT
    '=== KIỂM TRA MIGRATION ===' as info,
    role_backup as old_role,
    role_v2::TEXT as new_role,
    COUNT(*) as count
FROM user_profiles
GROUP BY role_backup, role_v2::TEXT
ORDER BY role_backup;

-- BƯỚC 9: Disable RLS
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- BƯỚC 10: Drop policies
DROP POLICY IF EXISTS "Admins can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Admin only access to system_settings" ON system_settings;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- BƯỚC 11: Drop column role cũ
ALTER TABLE user_profiles DROP COLUMN role;

-- BƯỚC 12: Drop enum cũ
DROP TYPE user_role;

-- BƯỚC 13: Rename enum và column mới
ALTER TYPE user_role_v2 RENAME TO user_role;
ALTER TABLE user_profiles RENAME COLUMN role_v2 TO role;

-- BƯỚC 14: Set constraints
ALTER TABLE user_profiles ALTER COLUMN role SET NOT NULL;
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'viewer'::user_role;

-- BƯỚC 15: Tạo lại policies
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

-- BƯỚC 16: Enable lại RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- BƯỚC 17: Kiểm tra kết quả cuối cùng
SELECT
    '=== KẾT QUẢ CUỐI CÙNG ===' as info,
    id,
    email,
    role::TEXT as current_role,
    role_backup as original_role,
    CASE
        WHEN (role::TEXT = role_backup) OR
             (role_backup = 'editor' AND role::TEXT = 'product_editor')
        THEN '✅ SUCCESS'
        ELSE '❌ NEED CHECK'
    END as status
FROM user_profiles
ORDER BY email;

-- BƯỚC 18: Hiển thị enum mới
SELECT '=== ENUM MỚI ===' as info;
SELECT unnest(enum_range(NULL::user_role)) as roles;

-- BƯỚC 19: Clean up (có thể uncomment sau khi kiểm tra)
-- ALTER TABLE user_profiles DROP COLUMN role_backup;

SELECT '✅ MIGRATION HOÀN TẤT!' as final_result;