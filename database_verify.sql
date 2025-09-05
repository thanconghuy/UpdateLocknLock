-- Verification script: Check migration results
-- Run this after migration to ensure everything is working correctly
-- Created: 2025-09-04

-- Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'products' 
ORDER BY ordinal_position;

-- Check data migration results
SELECT 
    'Total products' as metric,
    COUNT(*) as count
FROM products

UNION ALL

SELECT 
    'Products with website_id',
    COUNT(*)
FROM products 
WHERE website_id IS NOT NULL

UNION ALL

SELECT 
    'Products with category',
    COUNT(*)
FROM products 
WHERE category IS NOT NULL

UNION ALL

SELECT 
    'Products with valid price',
    COUNT(*)
FROM products 
WHERE price IS NOT NULL AND price > 0

UNION ALL

SELECT 
    'Products with promotional price',
    COUNT(*)
FROM products 
WHERE promotional_price IS NOT NULL AND promotional_price > 0

UNION ALL

SELECT 
    'Products with external URL',
    COUNT(*)
FROM products 
WHERE external_url IS NOT NULL

UNION ALL

SELECT 
    'Products with image URL',
    COUNT(*)
FROM products 
WHERE image_url IS NOT NULL

UNION ALL

SELECT 
    'Products with Shopee link',
    COUNT(*)
FROM products 
WHERE link_shopee IS NOT NULL

UNION ALL

SELECT 
    'Products with TikTok link',
    COUNT(*)
FROM products 
WHERE link_tiktok IS NOT NULL

UNION ALL

SELECT 
    'Products with Lazada link',
    COUNT(*)
FROM products 
WHERE link_lazada IS NOT NULL

UNION ALL

SELECT 
    'Products with DMX link',
    COUNT(*)
FROM products 
WHERE link_dmx IS NOT NULL;

-- Sample data check
SELECT 
    id,
    website_id,
    sku,
    title,
    price,
    promotional_price,
    category,
    CASE 
        WHEN LENGTH(external_url) > 50 
        THEN LEFT(external_url, 47) || '...' 
        ELSE external_url 
    END as external_url_preview,
    CASE 
        WHEN LENGTH(image_url) > 50 
        THEN LEFT(image_url, 47) || '...' 
        ELSE image_url 
    END as image_url_preview,
    currency,
    updated_at
FROM products 
LIMIT 5;

-- Check for potential data issues
SELECT 
    'Data Issues Check' as section,
    '' as issue_type,
    0 as count
WHERE 1=0

UNION ALL

SELECT 
    'Data Issues',
    'Products with empty title',
    COUNT(*)
FROM products 
WHERE title IS NULL OR title = ''

UNION ALL

SELECT 
    'Data Issues',
    'Products with invalid price',
    COUNT(*)
FROM products 
WHERE price IS NOT NULL AND price < 0

UNION ALL

SELECT 
    'Data Issues',
    'Products with promotional > regular price',
    COUNT(*)
FROM products 
WHERE promotional_price IS NOT NULL 
  AND price IS NOT NULL 
  AND promotional_price > price;

-- Index verification
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'products'
ORDER BY indexname;