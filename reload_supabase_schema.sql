-- =====================================================
-- RELOAD SUPABASE SCHEMA CACHE
-- Chạy script này sau khi tạo functions mới
-- Để PostgREST nhận biết functions mới
-- =====================================================

-- Method 1: Send NOTIFY to PostgREST
NOTIFY pgrst, 'reload schema';

-- Method 2: Alternative - reload config
NOTIFY pgrst, 'reload config';

SELECT '✅ Schema reload signal sent to PostgREST' as result;
SELECT '⏳ Wait 5-10 seconds for PostgREST to reload' as note;
SELECT '🔄 Then refresh your browser and test again' as action;
