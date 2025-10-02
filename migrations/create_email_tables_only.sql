-- ================================================================
-- EMAIL SYSTEM - TABLES ONLY (No default data)
-- ================================================================
-- Version: 2.0 - Simplified for UI management
-- Date: 2025-10-01
-- Note: Templates will be managed via UI, not hardcoded in DB

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- TABLE 1: EMAIL SETTINGS
-- ================================================================

CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL DEFAULT 'supabase',
  is_enabled BOOLEAN DEFAULT TRUE,
  
  -- SMTP Configuration
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_username VARCHAR(255),
  smtp_password TEXT,
  smtp_secure BOOLEAN DEFAULT TRUE,
  
  -- Provider API Keys
  sendgrid_api_key TEXT,
  resend_api_key TEXT,
  
  -- Email defaults
  from_email VARCHAR(255) NOT NULL DEFAULT 'noreply@locknlock.com',
  from_name VARCHAR(255) DEFAULT 'Lock & Lock Team',
  reply_to_email VARCHAR(255),
  
  -- Settings
  max_retry_attempts INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE email_settings IS 'Email provider configuration and SMTP settings';

-- ================================================================
-- TABLE 2: EMAIL TEMPLATES
-- ================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_key VARCHAR(100) UNIQUE NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  available_variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE email_templates IS 'Email templates - managed via UI';
COMMENT ON COLUMN email_templates.template_key IS 'Unique key: new_user_credentials, account_approved, password_reset, etc.';

CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active) WHERE is_active = TRUE;

-- ================================================================
-- TABLE 3: EMAIL LOGS
-- ================================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),
  template_key VARCHAR(100),
  subject TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  provider_used VARCHAR(50),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE email_logs IS 'Email sending history and status tracking';
COMMENT ON COLUMN email_logs.status IS 'Status: queued, sending, sent, failed, bounced';

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_key);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Email Settings: Admin only
DROP POLICY IF EXISTS "Admins can manage email settings" ON email_settings;
CREATE POLICY "Admins can manage email settings"
  ON email_settings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = TRUE
    )
  );

-- Email Templates: Admin only
DROP POLICY IF EXISTS "Admins can manage email templates" ON email_templates;
CREATE POLICY "Admins can manage email templates"
  ON email_templates FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = TRUE
    )
  );

-- Email Logs: Admin can view all
DROP POLICY IF EXISTS "Admins can view all email logs" ON email_logs;
CREATE POLICY "Admins can view all email logs"
  ON email_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = TRUE
    )
  );

-- Email Logs: Users can view their own
DROP POLICY IF EXISTS "Users can view their own email logs" ON email_logs;
CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT TO authenticated
  USING (
    recipient_email = (
      SELECT email FROM user_profiles WHERE id = auth.uid()
    )
  );

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_email_settings_updated_at ON email_settings;
CREATE TRIGGER update_email_settings_updated_at
  BEFORE UPDATE ON email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_logs_updated_at ON email_logs;
CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- GRANT PERMISSIONS
-- ================================================================

GRANT ALL ON email_settings TO authenticated;
GRANT ALL ON email_templates TO authenticated;
GRANT ALL ON email_logs TO authenticated;

-- ================================================================
-- ✅ MIGRATION COMPLETE
-- ================================================================
-- Next steps:
-- 1. Go to Admin Settings > Email Management
-- 2. Create email templates via UI
-- 3. Test email sending
-- ================================================================
