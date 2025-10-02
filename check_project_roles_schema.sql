-- Check project_roles table schema
SELECT
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'project_roles'
ORDER BY ordinal_position;

-- Check actual data
SELECT * FROM project_roles ORDER BY level DESC;
