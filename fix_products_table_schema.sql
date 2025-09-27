-- Fix products table schema to match sync requirements
-- Thêm các columns thiếu vào products table

BEGIN;

-- Add missing columns to products table
DO $$
BEGIN
    -- Add website_id column if it doesn't exist (critical for sync)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name = 'website_id'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE products
        ADD COLUMN website_id TEXT;

        RAISE NOTICE 'Added website_id column to products table';
    ELSE
        RAISE NOTICE 'website_id column already exists in products table';
    END IF;

    -- Add het_hang column if it doesn't exist (for stock status)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name = 'het_hang'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE products
        ADD COLUMN het_hang BOOLEAN DEFAULT false;

        RAISE NOTICE 'Added het_hang column to products table';
    ELSE
        RAISE NOTICE 'het_hang column already exists in products table';
    END IF;

    -- Add sku column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name = 'sku'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE products
        ADD COLUMN sku TEXT;

        RAISE NOTICE 'Added sku column to products table';
    ELSE
        RAISE NOTICE 'sku column already exists in products table';
    END IF;

    -- Add price column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name = 'price'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE products
        ADD COLUMN price DECIMAL(10,2);

        RAISE NOTICE 'Added price column to products table';
    ELSE
        RAISE NOTICE 'price column already exists in products table';
    END IF;

    -- Add promotional_price column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name = 'promotional_price'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE products
        ADD COLUMN promotional_price DECIMAL(10,2);

        RAISE NOTICE 'Added promotional_price column to products table';
    ELSE
        RAISE NOTICE 'promotional_price column already exists in products table';
    END IF;

    -- Add title column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products'
          AND column_name = 'title'
          AND table_schema = 'public'
    ) THEN
        ALTER TABLE products
        ADD COLUMN title TEXT;

        RAISE NOTICE 'Added title column to products table';
    ELSE
        RAISE NOTICE 'title column already exists in products table';
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_website_id ON products(website_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_het_hang ON products(het_hang);

-- Add unique constraint on website_id (important for upserts)
DO $$
BEGIN
    -- Remove existing constraints if they exist
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_website_id_key;
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_website_id_unique;

    -- Add unique constraint
    ALTER TABLE products ADD CONSTRAINT products_website_id_unique UNIQUE (website_id);
    RAISE NOTICE 'Added unique constraint on website_id';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add unique constraint on website_id (might already exist or have duplicates): %', SQLERRM;
END $$;

-- Add comments to document the columns
COMMENT ON COLUMN products.website_id IS 'Unique ID from website/WooCommerce for sync purposes';
COMMENT ON COLUMN products.het_hang IS 'Stock status: true = out of stock, false = in stock';
COMMENT ON COLUMN products.sku IS 'Product SKU from WooCommerce';
COMMENT ON COLUMN products.price IS 'Regular price';
COMMENT ON COLUMN products.promotional_price IS 'Sale/promotional price';
COMMENT ON COLUMN products.title IS 'Product title/name';

-- Verify the changes
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('website_id', 'het_hang', 'sku', 'price', 'promotional_price', 'title')
  AND table_schema = 'public'
ORDER BY column_name;

COMMIT;

-- Show success message
SELECT 'Products table schema updated successfully' as result;