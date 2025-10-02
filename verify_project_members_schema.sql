-- =====================================================
-- VERIFY: project_members table schema
-- Check which columns actually exist
-- =====================================================

-- Step 1: Check all columns in project_members
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'project_members'
ORDER BY ordinal_position;
