-- Migration script: Update products table schema
-- From old structure with raw/meta to new normalized structure
-- 
-- ID Strategy:
-- - id: Auto-incrementing database primary key (SERIAL)
-- - website_id: ID from CSV/website (unique constraint for upserts)
-- 
-- Created: 2025-09-04

-- Step 1: Create backup table
CREATE TABLE IF NOT EXISTS products_backup AS 
SELECT * FROM products;

-- Step 2: Add new columns to existing table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS website_id TEXT,
ADD COLUMN IF NOT EXISTS promotional_price NUMERIC,
ADD COLUMN IF NOT EXISTS external_url TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
-- Platform links and prices
ADD COLUMN IF NOT EXISTS link_shopee TEXT,
ADD COLUMN IF NOT EXISTS gia_shopee NUMERIC,
ADD COLUMN IF NOT EXISTS link_tiktok TEXT,
ADD COLUMN IF NOT EXISTS gia_tiktok NUMERIC,
ADD COLUMN IF NOT EXISTS link_lazada TEXT,
ADD COLUMN IF NOT EXISTS gia_lazada NUMERIC,
ADD COLUMN IF NOT EXISTS link_dmx TEXT,
ADD COLUMN IF NOT EXISTS gia_dmx NUMERIC;

-- Step 3: Migrate data from raw JSON to normalized columns (if raw column exists)
-- This attempts to extract common fields from the raw JSON data
DO $$
BEGIN
    -- Check if raw column exists before trying to migrate
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name='products' AND column_name='raw') THEN
        
        -- Update website_id from raw data
        UPDATE products 
        SET website_id = COALESCE(
            raw->>'website_id',
            raw->>'site_id', 
            raw->>'external_id',
            raw->>'web_id'
        )
        WHERE raw IS NOT NULL AND website_id IS NULL;

        -- Update promotional_price from raw data
        UPDATE products 
        SET promotional_price = CASE 
            WHEN raw->>'sale_price' ~ '^[0-9]+\.?[0-9]*$' 
            THEN (raw->>'sale_price')::NUMERIC
            WHEN raw->>'promotional_price' ~ '^[0-9]+\.?[0-9]*$' 
            THEN (raw->>'promotional_price')::NUMERIC
            WHEN raw->>'discount_price' ~ '^[0-9]+\.?[0-9]*$' 
            THEN (raw->>'discount_price')::NUMERIC
            ELSE NULL
        END
        WHERE raw IS NOT NULL AND promotional_price IS NULL;

        -- Update external_url from raw data
        UPDATE products 
        SET external_url = COALESCE(
            raw->>'url',
            raw->>'external_url',
            raw->>'product_url',
            raw->>'link'
        )
        WHERE raw IS NOT NULL AND external_url IS NULL;

        -- Update category from raw data
        UPDATE products 
        SET category = COALESCE(
            raw->>'category',
            raw->>'categories'
        )
        WHERE raw IS NOT NULL AND category IS NULL;

        -- Update image_url from raw data
        UPDATE products 
        SET image_url = COALESCE(
            raw->>'image',
            raw->>'image_url',
            raw->>'thumbnail'
        )
        WHERE raw IS NOT NULL AND image_url IS NULL;

        -- Update platform links and prices
        UPDATE products 
        SET 
            link_shopee = COALESCE(raw->>'link_shopee', raw->>'shopee_link'),
            gia_shopee = CASE 
                WHEN raw->>'gia_shopee' ~ '^[0-9,\s₫.]+$' THEN
                    REGEXP_REPLACE(REGEXP_REPLACE(raw->>'gia_shopee', '[₫,\s]', '', 'g'), '\.', '', 'g')::NUMERIC
                WHEN raw->>'shopee_price' ~ '^[0-9,\s₫.]+$' THEN
                    REGEXP_REPLACE(REGEXP_REPLACE(raw->>'shopee_price', '[₫,\s]', '', 'g'), '\.', '', 'g')::NUMERIC
                ELSE NULL
            END,
            link_tiktok = COALESCE(raw->>'link_tiktok', raw->>'tiktok_link'),
            gia_tiktok = CASE 
                WHEN raw->>'gia_tiktok' ~ '^[0-9,\s₫.]+$' THEN
                    REGEXP_REPLACE(REGEXP_REPLACE(raw->>'gia_tiktok', '[₫,\s]', '', 'g'), '\.', '', 'g')::NUMERIC
                WHEN raw->>'tiktok_price' ~ '^[0-9,\s₫.]+$' THEN
                    REGEXP_REPLACE(REGEXP_REPLACE(raw->>'tiktok_price', '[₫,\s]', '', 'g'), '\.', '', 'g')::NUMERIC
                ELSE NULL
            END,
            link_lazada = COALESCE(raw->>'link_lazada', raw->>'lazada_link'),
            gia_lazada = CASE 
                WHEN raw->>'gia_lazada' ~ '^[0-9,\s₫.]+$' THEN
                    REGEXP_REPLACE(REGEXP_REPLACE(raw->>'gia_lazada', '[₫,\s]', '', 'g'), '\.', '', 'g')::NUMERIC
                WHEN raw->>'lazada_price' ~ '^[0-9,\s₫.]+$' THEN
                    REGEXP_REPLACE(REGEXP_REPLACE(raw->>'lazada_price', '[₫,\s]', '', 'g'), '\.', '', 'g')::NUMERIC
                ELSE NULL
            END,
            link_dmx = COALESCE(raw->>'link_dmx', raw->>'dmx_link'),
            gia_dmx = CASE 
                WHEN raw->>'gia_dmx' ~ '^[0-9,\s₫.]+$' THEN
                    REGEXP_REPLACE(REGEXP_REPLACE(raw->>'gia_dmx', '[₫,\s]', '', 'g'), '\.', '', 'g')::NUMERIC
                WHEN raw->>'dmx_price' ~ '^[0-9,\s₫.]+$' THEN
                    REGEXP_REPLACE(REGEXP_REPLACE(raw->>'dmx_price', '[₫,\s]', '', 'g'), '\.', '', 'g')::NUMERIC
                ELSE NULL
            END
        WHERE raw IS NOT NULL;

        -- Update title if empty
        UPDATE products 
        SET title = COALESCE(
            title,
            raw->>'title',
            raw->>'name',
            raw->>'product_name',
            raw->>'post_title'
        )
        WHERE raw IS NOT NULL AND (title IS NULL OR title = '');

        -- Update sku if empty
        UPDATE products 
        SET sku = COALESCE(
            sku,
            raw->>'sku',
            raw->>'SKU',
            raw->>'product_code',
            raw->>'code'
        )
        WHERE raw IS NOT NULL AND (sku IS NULL OR sku = '');

        -- Update price if empty (clean Vietnamese currency format)
        UPDATE products 
        SET price = CASE 
            WHEN price IS NULL OR price = 0 THEN
                CASE 
                    WHEN raw->>'price' ~ '^[0-9,\s₫.]+$' THEN
                        -- Remove Vietnamese currency symbols and convert
                        REGEXP_REPLACE(
                            REGEXP_REPLACE(raw->>'price', '[₫,\s]', '', 'g'),
                            '\.', '', 'g'
                        )::NUMERIC
                    WHEN raw->>'regular_price' ~ '^[0-9,\s₫.]+$' THEN
                        REGEXP_REPLACE(
                            REGEXP_REPLACE(raw->>'regular_price', '[₫,\s]', '', 'g'),
                            '\.', '', 'g'
                        )::NUMERIC
                    WHEN raw->>'gia' ~ '^[0-9,\s₫.]+$' THEN
                        REGEXP_REPLACE(
                            REGEXP_REPLACE(raw->>'gia', '[₫,\s]', '', 'g'),
                            '\.', '', 'g'
                        )::NUMERIC
                    ELSE price
                END
            ELSE price
        END
        WHERE raw IS NOT NULL;

    END IF;
END $$;

-- Step 4: Set currency default for existing rows
UPDATE products 
SET currency = 'VND' 
WHERE currency IS NULL;

-- Step 5: Update timestamps
ALTER TABLE products 
ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE products 
SET updated_at = NOW() 
WHERE updated_at IS NULL;

-- Step 6: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_website_id ON products(website_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
-- Platform indexes
CREATE INDEX IF NOT EXISTS idx_products_link_shopee ON products(link_shopee);
CREATE INDEX IF NOT EXISTS idx_products_link_tiktok ON products(link_tiktok);
CREATE INDEX IF NOT EXISTS idx_products_link_lazada ON products(link_lazada);
CREATE INDEX IF NOT EXISTS idx_products_link_dmx ON products(link_dmx);

-- Step 7: Drop old columns (OPTIONAL - uncomment if you want to remove them)
-- WARNING: This will permanently delete raw and meta data
-- ALTER TABLE products DROP COLUMN IF EXISTS raw;
-- ALTER TABLE products DROP COLUMN IF EXISTS meta;

-- Step 8: Setup database ID strategy
-- Ensure database has proper ID structure
DO $$
DECLARE 
    id_exists BOOLEAN := FALSE;
    id_is_integer BOOLEAN := FALSE;
BEGIN
    -- Check if id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='products' AND column_name='id'
    ) INTO id_exists;
    
    -- Check if it's already an integer type
    IF id_exists THEN
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='products' AND column_name='id' 
            AND data_type IN ('integer', 'bigint')
        ) INTO id_is_integer;
    END IF;
    
    -- If we need to fix the id column
    IF NOT id_exists OR NOT id_is_integer THEN
        -- Drop existing constraints and column if needed
        ALTER TABLE products DROP CONSTRAINT IF EXISTS products_pkey;
        
        IF id_exists AND NOT id_is_integer THEN
            ALTER TABLE products DROP COLUMN id;
        END IF;
        
        -- Add proper serial primary key
        IF NOT id_exists OR NOT id_is_integer THEN
            ALTER TABLE products ADD COLUMN id SERIAL;
            ALTER TABLE products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
        END IF;
    END IF;
    
    -- Ensure website_id has unique constraint for upserts
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_website_id_key;
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_website_id_unique;
    
    -- Drop existing index if it exists
    DROP INDEX IF EXISTS idx_products_website_id_unique;
    DROP INDEX IF EXISTS idx_products_website_id;
    
    -- Add proper unique constraint (not just index) for ON CONFLICT to work
    ALTER TABLE products ADD CONSTRAINT products_website_id_unique 
    UNIQUE (website_id);
    
END $$;

-- Step 9: Create/update the audit table structure if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='product_updates') THEN
        -- Add new columns to audit table
        ALTER TABLE product_updates 
        ADD COLUMN IF NOT EXISTS product_website_id TEXT,
        ADD COLUMN IF NOT EXISTS old_values JSONB,
        ADD COLUMN IF NOT EXISTS new_values JSONB;
        
        -- Create index on audit table
        CREATE INDEX IF NOT EXISTS idx_product_updates_product_id ON product_updates(product_id);
        CREATE INDEX IF NOT EXISTS idx_product_updates_updated_at ON product_updates(updated_at);
    END IF;
END $$;

-- Verification queries (run these to check migration results)
-- SELECT COUNT(*) as total_products FROM products;
-- SELECT COUNT(*) as products_with_website_id FROM products WHERE website_id IS NOT NULL;
-- SELECT COUNT(*) as products_with_category FROM products WHERE category IS NOT NULL;
-- SELECT COUNT(*) as products_with_price FROM products WHERE price IS NOT NULL AND price > 0;
-- SELECT COUNT(*) as products_with_promotional_price FROM products WHERE promotional_price IS NOT NULL AND promotional_price > 0;

COMMIT;