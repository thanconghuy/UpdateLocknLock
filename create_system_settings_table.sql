-- Create system_settings table for admin configuration
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category VARCHAR(50) NOT NULL UNIQUE, -- 'database', 'woocommerce', etc.
    config_data TEXT NOT NULL, -- Encrypted JSON configuration
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT category_check CHECK (category IN ('database', 'woocommerce'))
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated_at ON system_settings(updated_at);

-- Enable Row Level Security
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Create policy: Only admins can access system settings
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

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_system_settings_updated_at_trigger ON system_settings;
CREATE TRIGGER update_system_settings_updated_at_trigger
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

-- Grant permissions
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON system_settings TO service_role;

-- Insert default configurations (optional)
-- You can uncomment these if you want to pre-populate with current env values
/*
INSERT INTO system_settings (category, config_data, created_by) VALUES
('database', encode('{"supabase_url":"","supabase_anon_key":"","default_products_table":"products","default_audit_table":"product_updates"}', 'base64'), (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (category) DO NOTHING;

INSERT INTO system_settings (category, config_data, created_by) VALUES
('woocommerce', encode('{"base_url":"","consumer_key":"","consumer_secret":"","version":"wc/v3","timeout":30000,"per_page":100,"verify_ssl":true}', 'base64'), (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (category) DO NOTHING;
*/