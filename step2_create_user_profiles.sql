-- ==========================================================================
-- STEP 2: CREATE USER PROFILES TABLE
-- ==========================================================================
-- Tạo bảng user_profiles
-- Chạy sau khi hoàn thành step1_create_enums.sql

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email varchar(255) UNIQUE NOT NULL,
    full_name varchar(255),
    avatar_url text,
    phone varchar(20),
    company varchar(255),

    -- System fields
    role user_role DEFAULT 'viewer'::user_role NOT NULL,
    is_active boolean DEFAULT true,
    last_login_at timestamptz,

    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active ON user_profiles(is_active);

-- 3. Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies (nếu có)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can manage all users" ON user_profiles;

-- 5. Create RLS policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins can view all profiles" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role
        )
    );

CREATE POLICY "Admins can manage all users" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'::user_role
        )
    );

-- 6. Function to auto-create user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.user_profiles (
        id,
        email,
        full_name,
        role
    )
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
        -- Profile already exists, skip
        RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Function to update timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create update timestamp trigger
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Create profiles for existing users
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
    SELECT 1 FROM user_profiles up WHERE up.id = au.id
)
ON CONFLICT (id) DO NOTHING;

-- 11. Verification
SELECT
    'USER PROFILES TABLE CREATED:' as status,
    (SELECT COUNT(*) FROM user_profiles)::text as total_profiles,
    (SELECT COUNT(*) FROM auth.users)::text as total_auth_users;

-- Show all user profiles
SELECT
    'CURRENT USER PROFILES:' as info,
    email,
    full_name,
    role::text,
    is_active,
    created_at
FROM user_profiles
ORDER BY created_at;