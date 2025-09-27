-- Script tạo user_profiles table và set admin user
-- Chạy script này trong Supabase SQL Editor

-- 1. Tạo enum cho user roles
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'editor', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tạo bảng user_profiles nếu chưa có
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email varchar(255) UNIQUE NOT NULL,
    full_name varchar(255),
    role user_role DEFAULT 'viewer',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Tạo RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users can update their own profile (except role)
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM user_profiles WHERE id = auth.uid()));

-- Policy: Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Admins can manage all users
CREATE POLICY "Admins can manage all users" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 4. Function để tự động tạo user profile khi user đăng ký
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        'viewer'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger để tự động tạo profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Set admin role cho email cụ thể (sau khi user đã đăng ký)
-- THAY ĐỔI EMAIL DƯỚI ĐÂY THÀNH EMAIL CỦA BẠN
UPDATE user_profiles
SET
    role = 'admin',
    updated_at = now()
WHERE email = 'vtphong91@gmail.com';

-- Nếu user chưa tồn tại, bạn cần đăng ký trước, sau đó chạy update này

-- 7. Kiểm tra kết quả
SELECT id, email, full_name, role, is_active, created_at
FROM user_profiles
WHERE email = 'vtphong91@gmail.com';