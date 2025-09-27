-- ====================================
-- STEP BY STEP SETUP - USER PERMISSION SYSTEM
-- Chạy từng bước một để tránh lỗi
-- ====================================

-- BƯỚC 1: Tạo enum user_role mới
-- Lưu ý: Phải drop enum cũ nếu có
DO $$
BEGIN
    -- Kiểm tra nếu enum đã tồn tại
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        -- Backup dữ liệu cũ trước khi drop
        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role_backup TEXT;
        UPDATE user_profiles SET role_backup = role::text;

        -- Drop constraint và column role cũ
        ALTER TABLE user_profiles DROP COLUMN IF EXISTS role;

        -- Drop enum cũ
        DROP TYPE IF EXISTS user_role;
    END IF;
END $$;

-- Tạo enum mới với 5 cấp độ
CREATE TYPE user_role AS ENUM (
    'admin',           -- Toàn quyền hệ thống
    'manager',         -- Quản lý project và team
    'product_editor',  -- Chỉnh sửa sản phẩm
    'project_viewer',  -- Xem project (read-only)
    'viewer'          -- Xem cơ bản
);

-- Thêm lại column role với enum mới
ALTER TABLE user_profiles ADD COLUMN role user_role DEFAULT 'viewer';

-- Restore dữ liệu từ backup
UPDATE user_profiles SET role =
    CASE
        WHEN role_backup = 'admin' THEN 'admin'::user_role
        WHEN role_backup = 'manager' THEN 'manager'::user_role
        WHEN role_backup = 'editor' THEN 'product_editor'::user_role
        ELSE 'viewer'::user_role
    END;

-- Xóa column backup
ALTER TABLE user_profiles DROP COLUMN IF EXISTS role_backup;

-- COMPLETED: ✅ Bước 1 hoàn thành
SELECT '✅ BƯỚC 1: Tạo user_role enum - HOÀN THÀNH' as status;