-- Fix numeric field overflow by expanding price column types
-- Mở rộng kiểu dữ liệu cho các cột giá để tránh overflow

BEGIN;

-- Expand price columns to handle larger values
DO $$
BEGIN
    -- Update main price columns to support larger values
    -- DECIMAL(15,2) = up to 999,999,999,999,999.99 (999 trillion)

    -- Main price column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price' AND table_schema = 'public') THEN
        ALTER TABLE products ALTER COLUMN price TYPE DECIMAL(15,2);
        RAISE NOTICE 'Updated price column to DECIMAL(15,2)';
    END IF;

    -- Promotional price column
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'promotional_price' AND table_schema = 'public') THEN
        ALTER TABLE products ALTER COLUMN promotional_price TYPE DECIMAL(15,2);
        RAISE NOTICE 'Updated promotional_price column to DECIMAL(15,2)';
    END IF;

    -- Platform-specific price columns
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_shopee' AND table_schema = 'public') THEN
        ALTER TABLE products ALTER COLUMN gia_shopee TYPE DECIMAL(15,2);
        RAISE NOTICE 'Updated gia_shopee column to DECIMAL(15,2)';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_tiktok' AND table_schema = 'public') THEN
        ALTER TABLE products ALTER COLUMN gia_tiktok TYPE DECIMAL(15,2);
        RAISE NOTICE 'Updated gia_tiktok column to DECIMAL(15,2)';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_lazada' AND table_schema = 'public') THEN
        ALTER TABLE products ALTER COLUMN gia_lazada TYPE DECIMAL(15,2);
        RAISE NOTICE 'Updated gia_lazada column to DECIMAL(15,2)';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_dmx' AND table_schema = 'public') THEN
        ALTER TABLE products ALTER COLUMN gia_dmx TYPE DECIMAL(15,2);
        RAISE NOTICE 'Updated gia_dmx column to DECIMAL(15,2)';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'gia_tiki' AND table_schema = 'public') THEN
        ALTER TABLE products ALTER COLUMN gia_tiki TYPE DECIMAL(15,2);
        RAISE NOTICE 'Updated gia_tiki column to DECIMAL(15,2)';
    END IF;

END $$;

-- Add comments to document the change
COMMENT ON COLUMN products.price IS 'Regular price - DECIMAL(15,2) supports up to 999 trillion';
COMMENT ON COLUMN products.promotional_price IS 'Sale/promotional price - DECIMAL(15,2) supports up to 999 trillion';

-- Verify the changes
SELECT
    column_name,
    data_type,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('price', 'promotional_price', 'gia_shopee', 'gia_tiktok', 'gia_lazada', 'gia_dmx', 'gia_tiki')
  AND table_schema = 'public'
ORDER BY column_name;

COMMIT;

-- Show success message
SELECT 'Price columns updated to handle larger values (DECIMAL 15,2)' as result;