-- 1. Kiểm tra bảng system_settings có tồn tại không
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'system_settings'
) AS table_exists;

-- 2. Nếu table_exists = false, tạo bảng
-- Uncomment và chạy phần này nếu bảng chưa tồn tại:

/*
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category VARCHAR(50) NOT NULL UNIQUE,
    config_data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT category_check CHECK (category IN ('database', 'woocommerce'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at);

-- Enable RLS
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Admin only access to system_settings"
ON system_settings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
        AND user_profiles.is_active = true
    )
);

-- Permissions
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON system_settings TO service_role;
*/