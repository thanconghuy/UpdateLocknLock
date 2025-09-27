-- Add WooCommerce credentials columns to projects table
-- Thêm columns để lưu WooCommerce credentials cho mỗi project

BEGIN;

-- Check if columns already exist before adding them
DO $$
BEGIN
    -- Add woocommerce_consumer_key column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects'
          AND column_name = 'woocommerce_consumer_key'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE projects
        ADD COLUMN woocommerce_consumer_key TEXT;

        RAISE NOTICE 'Added woocommerce_consumer_key column to projects table';
    ELSE
        RAISE NOTICE 'woocommerce_consumer_key column already exists in projects table';
    END IF;

    -- Add woocommerce_consumer_secret column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'projects'
          AND column_name = 'woocommerce_consumer_secret'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE projects
        ADD COLUMN woocommerce_consumer_secret TEXT;

        RAISE NOTICE 'Added woocommerce_consumer_secret column to projects table';
    ELSE
        RAISE NOTICE 'woocommerce_consumer_secret column already exists in projects table';
    END IF;
END $$;

-- Add comments to document the new columns
COMMENT ON COLUMN projects.woocommerce_consumer_key IS 'WooCommerce Consumer Key for this specific project/store';
COMMENT ON COLUMN projects.woocommerce_consumer_secret IS 'WooCommerce Consumer Secret for this specific project/store';

-- Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'projects'
  AND column_name IN ('woocommerce_consumer_key', 'woocommerce_consumer_secret')
  AND table_schema = 'public';

COMMIT;

-- Show success message
SELECT 'Projects table updated with WooCommerce credentials columns' as result;