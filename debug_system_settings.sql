-- Debug script để kiểm tra bảng system_settings

-- 1. Kiểm tra xem bảng system_settings có tồn tại không
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'system_settings'
) AS table_exists;

-- 2. Kiểm tra cấu trúc bảng
\d system_settings;

-- 3. Kiểm tra dữ liệu hiện tại trong bảng
SELECT id, category, created_at, updated_at, created_by
FROM system_settings
ORDER BY updated_at DESC
LIMIT 10;

-- 4. Kiểm tra RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'system_settings';

-- 5. Kiểm tra permissions
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'system_settings';

-- 6. Test insert (nếu có quyền admin)
-- INSERT INTO system_settings (category, config_data, created_by) VALUES
-- ('test', 'eyJ0ZXN0IjoidmFsdWUifQ==', (SELECT id FROM user_profiles WHERE role = 'admin' LIMIT 1))
-- ON CONFLICT (category) DO NOTHING;

-- 7. Test select với current user
SELECT current_user, session_user;
SELECT auth.uid() as current_user_id;
SELECT * FROM user_profiles WHERE id = auth.uid();