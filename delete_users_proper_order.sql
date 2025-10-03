-- XÓA USERS ĐÚNG THỨ TỰ - Tránh Foreign Key Constraint Errors
-- Chạy từng bước một trong Supabase SQL Editor

-- ====================================
-- STEP 1: XÓA DEPENDENCIES TRƯỚC
-- ====================================

-- 1a. Xóa từ project_members (nếu có)
DELETE FROM project_members
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email NOT IN (
    'beecaredotvn@gmail.com',
    'thanconghuy@gmail.com',
    'huythan.it@gmail.com'
  )
);

-- 1b. Xóa từ user_profiles
DELETE FROM user_profiles
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email NOT IN (
    'beecaredotvn@gmail.com',
    'thanconghuy@gmail.com',
    'huythan.it@gmail.com'
  )
);

-- 1c. Xóa từ auth.identities
DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email NOT IN (
    'beecaredotvn@gmail.com',
    'thanconghuy@gmail.com',
    'huythan.it@gmail.com'
  )
);

-- ====================================
-- STEP 2: BÂY GIỜ MỚI XÓA AUTH.USERS
-- ====================================

-- 2. Xóa từ auth.users
DELETE FROM auth.users
WHERE email NOT IN (
  'beecaredotvn@gmail.com',
  'thanconghuy@gmail.com',
  'huythan.it@gmail.com'
);

-- ====================================
-- STEP 3: VERIFY
-- ====================================

-- Check còn bao nhiêu users
SELECT COUNT(*) as total_users,
       STRING_AGG(email, ', ') as remaining_emails
FROM auth.users;

-- Kết quả phải là: 3 users (beecaredotvn, thanconghuy, huythan.it)
