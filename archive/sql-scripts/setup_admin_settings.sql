-- Setup script for Admin Settings functionality
-- Run this in your Supabase SQL Editor

-- 1. Create system_settings table (if not exists)
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category VARCHAR(50) NOT NULL UNIQUE,
    config_data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    CONSTRAINT category_check CHECK (category IN ('database', 'woocommerce'))
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at);

-- 3. Enable Row Level Security
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin only access to system_settings" ON system_settings;

-- 5. Create RLS policy for admin-only access
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

-- 6. Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger
DROP TRIGGER IF EXISTS update_system_settings_updated_at_trigger ON system_settings;
CREATE TRIGGER update_system_settings_updated_at_trigger
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

-- 8. Grant necessary permissions
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON system_settings TO service_role;

-- 9. Verify your admin user exists and has the right role
-- This should show your admin user
SELECT id, email, role, is_active
FROM user_profiles
WHERE role = 'admin' AND is_active = true;

-- 10. Test the setup by trying to insert a test record (as admin)
-- This will fail if you're not logged in as an admin user in the app
-- INSERT INTO system_settings (category, config_data, created_by) VALUES
-- ('database', 'eyJ0ZXN0IjoidmFsdWUifQ==', (SELECT id FROM user_profiles WHERE role = 'admin' LIMIT 1))
-- ON CONFLICT (category) DO NOTHING;

-- 11. Clean up test record
-- DELETE FROM system_settings WHERE config_data = 'eyJ0ZXN0IjoidmFsdWUifQ==';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Admin Settings setup completed successfully!';
    RAISE NOTICE 'You can now use the Admin Settings interface in your application.';
END $$;