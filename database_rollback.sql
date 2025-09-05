-- Rollback script: Restore products table from backup
-- Use this if the migration causes issues
-- Created: 2025-09-04

-- Step 1: Check if backup exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='products_backup') THEN
        RAISE EXCEPTION 'Backup table products_backup does not exist. Cannot rollback.';
    END IF;
END $$;

-- Step 2: Drop current products table and restore from backup
BEGIN;

-- Rename current table to keep as reference
DROP TABLE IF EXISTS products_failed_migration;
ALTER TABLE products RENAME TO products_failed_migration;

-- Restore from backup
CREATE TABLE products AS SELECT * FROM products_backup;

-- Recreate constraints and indexes that may have been lost
ALTER TABLE products ADD PRIMARY KEY (id);

-- Recreate common indexes
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);

-- Verify restoration
SELECT 
    'Rollback completed' as status,
    COUNT(*) as restored_records 
FROM products;

COMMIT;

-- Cleanup (run manually after verifying rollback worked)
-- DROP TABLE IF EXISTS products_backup;
-- DROP TABLE IF EXISTS products_failed_migration;