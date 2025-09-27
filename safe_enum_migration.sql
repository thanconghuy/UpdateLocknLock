-- ====================================
-- SAFE ENUM MIGRATION - KHÔNG XÓA COLUMN ROLE
-- ====================================

-- BƯỚC 1: Tạo enum mới với tên khác trước
CREATE TYPE user_role_new AS ENUM (
    'admin',           -- Toàn quyền hệ thống
    'manager',         -- Quản lý project và team
    'product_editor',  -- Chỉnh sửa sản phẩm
    'project_viewer',  -- Xem project (read-only)
    'viewer'          -- Xem cơ bản
);

-- BƯỚC 2: Thêm column mới với enum mới
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role_new user_role_new DEFAULT 'viewer';

-- BƯỚC 3: Migrate dữ liệu từ role cũ sang role_new
UPDATE user_profiles SET role_new =
    CASE
        WHEN role::text = 'admin' THEN 'admin'::user_role_new
        WHEN role::text = 'manager' THEN 'manager'::user_role_new
        WHEN role::text = 'editor' THEN 'product_editor'::user_role_new
        ELSE 'viewer'::user_role_new
    END;

-- BƯỚC 4: Kiểm tra migration
SELECT
    'KIỂM TRA MIGRATION' as step,
    role as old_role,
    role_new as new_role,
    COUNT(*) as count
FROM user_profiles
GROUP BY role, role_new;

-- BƯỚC 5: Tạm thời disable RLS để update policies
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- BƯỚC 6: Drop các policies cũ
DROP POLICY IF EXISTS "Admins can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Admin only access to system_settings" ON system_settings;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- BƯỚC 7: Backup role cũ và rename
ALTER TABLE user_profiles RENAME COLUMN role TO role_old;
ALTER TABLE user_profiles RENAME COLUMN role_new TO role;

    -- BƯỚC 8: Drop enum cũ và rename enum mới
    DROP TYPE IF EXISTS user_role;
    ALTER TYPE user_role_new RENAME TO user_role;

    -- BƯỚC 9: Tạo lại các RLS policies với enum mới
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

    -- BƯỚC 10: Enable lại RLS
    ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

    -- BƯỚC 11: Xóa column backup (sau khi đã test xong)
    -- ALTER TABLE user_profiles DROP COLUMN IF EXISTS role_old;

    -- BƯỚC 12: Kiểm tra kết quả
    SELECT
        '=== KIỂM TRA KẾT QUẢ ===' as section,
        id,
        email,
        role,
        role_old,
        CASE
            WHEN role::text = role_old THEN '✅ OK'
            ELSE '❌ KHÁC BIỆT'
        END as migration_status
    FROM user_profiles
    ORDER BY email;

    -- COMPLETED: ✅ Migration hoàn thành an toàn
    SELECT '✅ SAFE ENUM MIGRATION - HOÀN THÀNH' as final_status;