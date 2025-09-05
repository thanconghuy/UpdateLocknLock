-- Simple Migration Script: Update products table schema
-- Run this step by step if needed
-- Created: 2025-09-04

-- Step 1: Create backup table
CREATE TABLE IF NOT EXISTS products_backup AS 
SELECT * FROM products;

-- Step 2: Add new columns to existing table (run this first)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS website_id TEXT,
ADD COLUMN IF NOT EXISTS promotional_price NUMERIC,
ADD COLUMN IF NOT EXISTS external_url TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS link_shopee TEXT,
ADD COLUMN IF NOT EXISTS gia_shopee NUMERIC,
ADD COLUMN IF NOT EXISTS link_tiktok TEXT,
ADD COLUMN IF NOT EXISTS gia_tiktok NUMERIC,
ADD COLUMN IF NOT EXISTS link_lazada TEXT,
ADD COLUMN IF NOT EXISTS gia_lazada NUMERIC,
ADD COLUMN IF NOT EXISTS link_dmx TEXT,
ADD COLUMN IF NOT EXISTS gia_dmx NUMERIC;

-- Step 3: Set currency default
UPDATE products SET currency = 'VND' WHERE currency IS NULL;

-- Step 4: Update timestamps
ALTER TABLE products ALTER COLUMN updated_at SET DEFAULT NOW();
UPDATE products SET updated_at = NOW() WHERE updated_at IS NULL;

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_website_id ON products(website_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_link_shopee ON products(link_shopee);
CREATE INDEX IF NOT EXISTS idx_products_link_tiktok ON products(link_tiktok);
CREATE INDEX IF NOT EXISTS idx_products_link_lazada ON products(link_lazada);
CREATE INDEX IF NOT EXISTS idx_products_link_dmx ON products(link_dmx);

-- Step 6: Setup ID strategy (CRITICAL - run this carefully)
-- First, let's see what we have:
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name='products' AND column_name='id';

-- If ID is not SERIAL/INTEGER, run these commands ONE BY ONE:

-- 6a. Drop existing primary key constraint if exists
-- ALTER TABLE products DROP CONSTRAINT IF EXISTS products_pkey;

-- 6b. Drop existing id column if it's not integer type
-- ALTER TABLE products DROP COLUMN IF EXISTS id;

-- 6c. Add new SERIAL primary key
-- ALTER TABLE products ADD COLUMN id SERIAL PRIMARY KEY;

-- Step 7: Add unique constraint on website_id for upserts
-- Drop existing constraints first
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_website_id_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_website_id_unique;

-- Add unique constraint
ALTER TABLE products ADD CONSTRAINT products_website_id_unique UNIQUE (website_id);

-- Step 8: Verification queries
-- Run these to check everything is working:
/*
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name='products' 
ORDER BY ordinal_position;

SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name='products';

SELECT COUNT(*) as total_products FROM products;
*/