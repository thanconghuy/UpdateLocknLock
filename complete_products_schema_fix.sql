-- Complete products table schema fix
-- Thêm TẤT CẢ columns thiếu vào products table

BEGIN;

-- Add ALL missing columns to products table
DO $$
BEGIN
    -- Core product info columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'website_id' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN website_id TEXT;
        RAISE NOTICE 'Added website_id column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'title' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN title TEXT;
        RAISE NOTICE 'Added title column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sku' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN sku TEXT;
        RAISE NOTICE 'Added sku column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN price DECIMAL(10,2);
        RAISE NOTICE 'Added price column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'promotional_price' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN promotional_price DECIMAL(10,2);
        RAISE NOTICE 'Added promotional_price column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'currency' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN currency TEXT DEFAULT 'VND';
        RAISE NOTICE 'Added currency column';
    END IF;

    -- Stock and status columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'het_hang' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN het_hang BOOLEAN DEFAULT false;
        RAISE NOTICE 'Added het_hang column';
    END IF;

    -- URLs and images
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'image_url' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN image_url TEXT;
        RAISE NOTICE 'Added image_url column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'external_url' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN external_url TEXT;
        RAISE NOTICE 'Added external_url column';
    END IF;

    -- Platform-specific columns (combined as JSON or TEXT)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'shopee' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN shopee TEXT;
        RAISE NOTICE 'Added shopee column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tiktok' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN tiktok TEXT;
        RAISE NOTICE 'Added tiktok column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'lazada' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN lazada TEXT;
        RAISE NOTICE 'Added lazada column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'dmx' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN dmx TEXT;
        RAISE NOTICE 'Added dmx column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tiki' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN tiki TEXT;
        RAISE NOTICE 'Added tiki column';
    END IF;

    -- Individual platform link and price columns (if used by some parts of the system)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'link_shopee' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN link_shopee TEXT;
        RAISE NOTICE 'Added link_shopee column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_shopee' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN gia_shopee DECIMAL(10,2);
        RAISE NOTICE 'Added gia_shopee column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'link_tiktok' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN link_tiktok TEXT;
        RAISE NOTICE 'Added link_tiktok column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_tiktok' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN gia_tiktok DECIMAL(10,2);
        RAISE NOTICE 'Added gia_tiktok column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'link_lazada' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN link_lazada TEXT;
        RAISE NOTICE 'Added link_lazada column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_lazada' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN gia_lazada DECIMAL(10,2);
        RAISE NOTICE 'Added gia_lazada column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'link_dmx' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN link_dmx TEXT;
        RAISE NOTICE 'Added link_dmx column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_dmx' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN gia_dmx DECIMAL(10,2);
        RAISE NOTICE 'Added gia_dmx column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'link_tiki' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN link_tiki TEXT;
        RAISE NOTICE 'Added link_tiki column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_tiki' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN gia_tiki DECIMAL(10,2);
        RAISE NOTICE 'Added gia_tiki column';
    END IF;

    -- Stock quantity
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'so_luong_ton' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN so_luong_ton INTEGER;
        RAISE NOTICE 'Added so_luong_ton column';
    END IF;

    -- Category
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN category TEXT;
        RAISE NOTICE 'Added category column';
    END IF;

    -- Timestamps
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'created_at' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'updated_at' AND table_schema = 'public') THEN
        ALTER TABLE products ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column';
    END IF;

END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_website_id ON products(website_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_het_hang ON products(het_hang);
CREATE INDEX IF NOT EXISTS idx_products_title ON products(title);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);

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
        RAISE NOTICE 'Could not add unique constraint on website_id: %', SQLERRM;
END $$;

-- Update any existing records to have default currency
UPDATE products SET currency = 'VND' WHERE currency IS NULL;

-- Add comments to document the columns
COMMENT ON COLUMN products.website_id IS 'Unique ID from website/WooCommerce for sync purposes';
COMMENT ON COLUMN products.title IS 'Product title/name';
COMMENT ON COLUMN products.sku IS 'Product SKU from WooCommerce';
COMMENT ON COLUMN products.price IS 'Regular price';
COMMENT ON COLUMN products.promotional_price IS 'Sale/promotional price';
COMMENT ON COLUMN products.currency IS 'Currency code (default: VND)';
COMMENT ON COLUMN products.het_hang IS 'Stock status: true = out of stock, false = in stock';
COMMENT ON COLUMN products.image_url IS 'Product image URL';
COMMENT ON COLUMN products.external_url IS 'External product URL';
COMMENT ON COLUMN products.so_luong_ton IS 'Stock quantity';
COMMENT ON COLUMN products.category IS 'Product category';

-- Show final table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'products'
  AND table_schema = 'public'
ORDER BY ordinal_position;

COMMIT;

-- Show success message
SELECT 'Products table schema completely updated!' as result;