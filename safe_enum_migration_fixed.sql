-- ====================================
-- SAFE ENUM MIGRATION - FIXED VERSION
-- Xử lý đúng thứ tự để tránh dependency conflicts
-- ====================================

-- BƯỚC 1: Tạo enum mới với tên khác
DROP TYPE IF EXISTS user_role_new;
CREATE TYPE user_role_new AS ENUM (
    'admin',           -- Toàn quyền hệ thống
    'manager',         -- Quản lý project và team
    'product_editor',  -- Chỉnh sửa sản phẩm
    'project_viewer',  -- Xem project (read-only)
    'viewer'          -- Xem cơ bản
);

-- BƯỚC 2: Thêm column backup với TEXT type thay vì enum
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role_backup TEXT;

-- BƯỚC 3: Backup dữ liệu role hiện tại vào TEXT column
UPDATE user_profiles SET role_backup = role::TEXT;

-- BƯỚC 4: Thêm column mới với enum mới
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role_new user_role_new DEFAULT 'viewer';

-- BƯỚC 5: Migrate dữ liệu từ role cũ sang role_new
UPDATE user_profiles SET role_new =
    CASE
        WHEN role::TEXT = 'admin' THEN 'admin'::user_role_new
        WHEN role::TEXT = 'manager' THEN 'manager'::user_role_new
        WHEN role::TEXT = 'editor' THEN 'product_editor'::user_role_new
        WHEN role::TEXT = 'product_editor' THEN 'product_editor'::user_role_new
        WHEN role::TEXT = 'project_viewer' THEN 'project_viewer'::user_role_new
        ELSE 'viewer'::user_role_new
    END;

-- BƯỚC 6: Kiểm tra migration
SELECT
    'KIỂM TRA MIGRATION' as step,
    role::TEXT as old_role,
    role_new::TEXT as new_role,
    role_backup,
    COUNT(*) as count
FROM user_profiles
GROUP BY role::TEXT, role_new::TEXT, role_backup;

-- BƯỚC 7: Disable RLS để update policies
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- BƯỚC 8: Drop tất cả policies phụ thuộc vào enum cũ
DROP POLICY IF EXISTS "Admins can manage all users" ON user_profiles;
DROP POLICY IF EXISTS "Admin only access to system_settings" ON system_settings;
DROP POLICY IF EXISTS "Users can view their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

-- BƯỚC 9: Drop column role cũ (giờ đã an toàn vì không còn policies)
ALTER TABLE user_profiles DROP COLUMN role;

-- BƯỚC 10: Drop enum cũ (giờ đã an toàn)
DROP TYPE user_role;

-- BƯỚC 11: Rename enum mới thành tên cũ
ALTER TYPE user_role_new RENAME TO user_role;

-- BƯỚC 12: Rename column mới thành tên cũ
ALTER TABLE user_profiles RENAME COLUMN role_new TO role;

-- BƯỚC 13: Set NOT NULL constraint cho role
ALTER TABLE user_profiles ALTER COLUMN role SET NOT NULL;

-- BƯỚC 14: Tạo lại các RLS policies với enum mới
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

-- BƯỚC 15: Enable lại RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- BƯỚC 16: Kiểm tra kết quả cuối cùng
SELECT
    '=== KIỂM TRA KẾT QUẢ CUỐI CÙNG ===' as section,
    id,
    email,
    role::TEXT as current_role,
    role_backup as original_role,
    CASE
        WHEN (role::TEXT = role_backup) OR
             (role_backup = 'editor' AND role::TEXT = 'product_editor')
        THEN '✅ MIGRATION OK'
        ELSE '❌ CẦN KIỂM TRA'
    END as migration_status
FROM user_profiles
ORDER BY email;

-- BƯỚC 17: Có thể xóa column backup sau khi kiểm tra xong
-- Uncomment dòng dưới nếu migration thành công
-- ALTER TABLE user_profiles DROP COLUMN role_backup;

-- COMPLETED: ✅ Migration hoàn thành
SELECT '✅ SAFE ENUM MIGRATION - HOÀN THÀNH AN TOÀN' as final_status;

-- Hiển thị enum mới
SELECT '=== ENUM MỚI ===' as info;
SELECT unnest(enum_range(NULL::user_role)) as available_roles;