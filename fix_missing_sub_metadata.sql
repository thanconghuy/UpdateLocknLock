-- FIX: Thêm 'sub' vào raw_user_meta_data cho users thiếu
-- Root cause: Users cũ thiếu field 'sub' trong metadata → reset password lỗi 500

-- 1. Check users thiếu 'sub' trong metadata
SELECT
  email,
  id,
  raw_user_meta_data,
  CASE
    WHEN raw_user_meta_data::jsonb ? 'sub' THEN '✅ HAS sub'
    ELSE '❌ MISSING sub'
  END as sub_status
FROM auth.users
WHERE NOT (raw_user_meta_data::jsonb ? 'sub')
ORDER BY email;

-- 2. FIX: Update metadata cho user mktonline2018
UPDATE auth.users
SET
  raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data::jsonb, '{}'::jsonb),
    '{sub}',
    to_jsonb(id::text)
  ),
  updated_at = NOW()
WHERE email = 'mktonline2018@gmail.com';

-- 3. FIX ALL: Update TẤT CẢ users thiếu 'sub'
UPDATE auth.users
SET
  raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data::jsonb, '{}'::jsonb),
    '{sub}',
    to_jsonb(id::text)
  ),
  updated_at = NOW()
WHERE NOT (raw_user_meta_data::jsonb ? 'sub');

-- 4. Verify sau khi fix
SELECT
  email,
  raw_user_meta_data::jsonb ->> 'sub' as sub_value,
  raw_user_meta_data
FROM auth.users
WHERE email = 'mktonline2018@gmail.com';

-- 5. Check tất cả users đã OK chưa
SELECT
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE raw_user_meta_data::jsonb ? 'sub') as users_with_sub,
  COUNT(*) FILTER (WHERE NOT (raw_user_meta_data::jsonb ? 'sub')) as users_missing_sub
FROM auth.users;
