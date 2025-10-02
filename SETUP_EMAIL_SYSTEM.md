# 📧 Hướng Dẫn Setup Email System

## Bước 1: Mở Supabase SQL Editor

1. Truy cập: https://supabase.com/dashboard/project/zuzrtaknydgbawgpwdfv
2. Click vào menu **SQL Editor** bên trái
3. Click **New Query**

## Bước 2: Copy & Run Migration SQL

Copy toàn bộ nội dung file `migrations/create_email_system.sql` và paste vào SQL Editor.

Hoặc copy trực tiếp từ đây:

```sql
-- ================================================================
-- EMAIL SYSTEM DATABASE SCHEMA
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLE 1: EMAIL SETTINGS
CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',
  provider VARCHAR(50) NOT NULL DEFAULT 'supabase',
  is_enabled BOOLEAN DEFAULT TRUE,
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_username VARCHAR(255),
  smtp_password TEXT,
  smtp_secure BOOLEAN DEFAULT TRUE,
  sendgrid_api_key TEXT,
  resend_api_key TEXT,
  from_email VARCHAR(255) NOT NULL DEFAULT 'noreply@locknlock.com',
  from_name VARCHAR(255) DEFAULT 'Lock & Lock Team',
  reply_to_email VARCHAR(255),
  max_retry_attempts INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default config
INSERT INTO email_settings (id, provider, from_email, from_name, is_enabled)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'supabase',
  'noreply@locknlock.com',
  'Lock & Lock Team',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- TABLE 2: EMAIL TEMPLATES
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

-- Insert default templates (from migration file)
-- Copy from migrations/create_email_system.sql lines 100-313

-- TABLE 3: EMAIL LOGS
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

-- Enable RLS
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Admin only)
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
```

## Bước 3: Click "Run"

Nhấn nút **Run** hoặc Ctrl+Enter để execute SQL.

## Bước 4: Verify

Chạy query sau để verify:

```sql
SELECT * FROM email_settings;
SELECT template_key, template_name, is_active FROM email_templates;
SELECT COUNT(*) FROM email_logs;
```

## ✅ Hoàn thành!

Sau khi chạy xong, quay lại ứng dụng và thử tạo user mới. Email sẽ được gửi tự động!

---

**LƯU Ý**: File migration đầy đủ với email templates nằm tại `migrations/create_email_system.sql`
