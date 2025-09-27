-- Script tạo bảng user_profiles và setup policies
-- Chạy TRƯỚC khi chạy update_user_to_admin.sql

-- 1. Tạo enum cho user roles nếu chưa có
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'manager', 'editor', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'user_role enum already exists, skipping...';
END $$;

-- 2. Tạo bảng user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email varchar(255) UNIQUE NOT NULL,
    full_name varchar(255),
    role user_role DEFAULT 'viewer'::user_role,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Tạo index cho performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- 4. Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies nếu có để tạo lại
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all users" ON user_profiles;

-- 6. Tạo RLS policies
-- Policy: Users có thể xem profile của chính mình
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Policy: Users có thể update profile của mình (trừ role)
CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
    );

-- Policy: Admins có thể xem tất cả profiles
CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role
        )
    );

-- Policy: Admins có thể quản lý tất cả users
CREATE POLICY "Admins can manage all users" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role
        )
    );

-- 7. Function để tự động tạo user profile khi có user mới
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
        new.id,
        new.email,
        COALESCE(
            new.raw_user_meta_data->>'full_name',
            new.raw_user_meta_data->>'display_name',
            split_part(new.email, '@', 1)
        ),
        'viewer'::user_role
    );
    RETURN new;
EXCEPTION
    WHEN unique_violation THEN
        -- Nếu đã tồn tại, bỏ qua
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Tạo trigger (xóa cũ nếu có)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Function để update timestamp khi có thay đổi
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Trigger để tự động update updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Tạo profile cho tất cả users hiện tại chưa có profile
INSERT INTO user_profiles (id, email, full_name, role)
SELECT
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'display_name',
        split_part(au.email, '@', 1)
    ),
    'viewer'::user_role
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- 12. Hiển thị kết quả
SELECT
    'Setup completed successfully!' as status,
    COUNT(*) as total_user_profiles
FROM user_profiles;