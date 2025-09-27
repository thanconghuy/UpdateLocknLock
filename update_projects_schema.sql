-- ====================================
-- UPDATE PROJECTS SCHEMA
-- Bỏ consumer_key và consumer_secret khỏi projects table
-- Vì sẽ load từ Admin Settings tập trung
-- ====================================

-- Kiểm tra columns hiện tại trong projects table
SELECT
    '=== PROJECTS TABLE COLUMNS ===' as info,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name LIKE '%woocommerce%'
ORDER BY column_name;

-- Bước 1: Backup dữ liệu nếu có (optional)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'woocommerce_consumer_key'
    ) THEN
        -- Tạo bảng backup nếu cần
        CREATE TABLE IF NOT EXISTS projects_woocommerce_backup (
            project_id UUID,
            consumer_key TEXT,
            consumer_secret TEXT,
            backed_up_at TIMESTAMP DEFAULT NOW()
        );

        -- Backup credentials trước khi drop
        INSERT INTO projects_woocommerce_backup (project_id, consumer_key, consumer_secret)
        SELECT id, woocommerce_consumer_key, woocommerce_consumer_secret
        FROM projects
        WHERE woocommerce_consumer_key IS NOT NULL
        OR woocommerce_consumer_secret IS NOT NULL;

        RAISE NOTICE 'Backed up WooCommerce credentials for % projects', (
            SELECT COUNT(*) FROM projects_woocommerce_backup
        );
    END IF;
END $$;

-- Bước 2: Drop các columns không cần thiết
ALTER TABLE projects DROP COLUMN IF EXISTS woocommerce_consumer_key;
ALTER TABLE projects DROP COLUMN IF EXISTS woocommerce_consumer_secret;

-- Bước 3: Thêm comment cho woocommerce_base_url
COMMENT ON COLUMN projects.woocommerce_base_url IS 'Base URL của WooCommerce store. Consumer key/secret sẽ load từ Admin Settings';

-- Bước 4: Kiểm tra kết quả
SELECT
    '=== KẾT QUẢ AFTER UPDATE ===' as info,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'projects'
AND column_name LIKE '%woocommerce%'
ORDER BY column_name;

-- Bước 5: Hiển thị backup table nếu có
SELECT
    '=== BACKUP DATA ===' as info,
    COUNT(*) as backed_up_projects
FROM projects_woocommerce_backup
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'projects_woocommerce_backup'
);

SELECT '✅ PROJECTS SCHEMA UPDATE COMPLETED!' as final_status;