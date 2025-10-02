-- ================================================================
-- EMAIL SYSTEM DATABASE SCHEMA
-- ================================================================
-- Purpose: Email configuration and template management
-- Version: 1.0.0
-- Date: 2025-10-01

-- ================================================================
-- TABLE 1: EMAIL SETTINGS (SMTP Configuration)
-- ================================================================

CREATE TABLE IF NOT EXISTS email_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001',

  -- Provider configuration
  provider VARCHAR(50) NOT NULL DEFAULT 'supabase',
  -- Options: 'supabase', 'sendgrid', 'resend', 'custom_smtp'

  is_enabled BOOLEAN DEFAULT TRUE,

  -- SMTP Configuration (for custom SMTP)
  smtp_host VARCHAR(255),
  smtp_port INTEGER DEFAULT 587,
  smtp_username VARCHAR(255),
  smtp_password TEXT, -- Encrypted in application layer
  smtp_secure BOOLEAN DEFAULT TRUE, -- TLS/SSL

  -- SendGrid Config (for future)
  sendgrid_api_key TEXT, -- Encrypted

  -- Resend Config (for future)
  resend_api_key TEXT, -- Encrypted

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

-- Insert default configuration
INSERT INTO email_settings (id, provider, from_email, from_name, is_enabled)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'supabase',
  'noreply@locknlock.com',
  'Lock & Lock Team',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Add comments
COMMENT ON TABLE email_settings IS 'Email provider configuration and SMTP settings';
COMMENT ON COLUMN email_settings.provider IS 'Email provider: supabase, sendgrid, resend, or custom_smtp';
COMMENT ON COLUMN email_settings.smtp_password IS 'SMTP password - encrypted in application layer';

-- ================================================================
-- TABLE 2: EMAIL TEMPLATES
-- ================================================================

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Template identification
  template_key VARCHAR(100) UNIQUE NOT NULL,
  -- Keys: 'welcome_user', 'new_user_credentials', 'password_reset', 'account_approved'

  template_name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Email content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT, -- Plain text fallback

  -- Variables available in template
  -- Use {{variable_name}} syntax in templates
  available_variables JSONB DEFAULT '[]'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default email templates
INSERT INTO email_templates (template_key, template_name, description, subject, body_html, body_text, available_variables) VALUES

-- Template 1: New User Credentials
('new_user_credentials',
 'New User Welcome & Credentials',
 'Email sent to new users with their login credentials',
 'Chào mừng đến với Lock & Lock Product Management System',
 '<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e0e0e0; }
    .credentials-box { background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; }
    .warning-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    .steps { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
    .steps li { margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Chào mừng đến với Lock & Lock</h1>
      <p>Product Management System</p>
    </div>

    <div class="content">
      <p>Xin chào <strong>{{user_name}}</strong>,</p>

      <p>Tài khoản của bạn đã được tạo thành công! Dưới đây là thông tin đăng nhập của bạn:</p>

      <div class="credentials-box">
        <p><strong>📧 Email/Username:</strong><br/>{{user_email}}</p>
        <p><strong>🔑 Mật khẩu tạm thời:</strong><br/><code style="font-size: 16px; background: #fff; padding: 5px 10px; border-radius: 3px;">{{temp_password}}</code></p>
      </div>

      <div class="warning-box">
        <p><strong>⚠️ LƯU Ý QUAN TRỌNG:</strong></p>
        <ul>
          <li>Đây là mật khẩu tạm thời</li>
          <li>Bạn <strong>SẼ BỊ BẮT BUỘC</strong> đổi mật khẩu khi đăng nhập lần đầu</li>
          <li>Vui lòng không chia sẻ thông tin này với bất kỳ ai</li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="{{login_url}}" class="button">🔗 Đăng nhập ngay</a>
      </div>

      <div class="steps">
        <p><strong>📋 Hướng dẫn đăng nhập:</strong></p>
        <ol>
          <li>Click vào nút "Đăng nhập ngay" ở trên hoặc truy cập: {{login_url}}</li>
          <li>Nhập email và mật khẩu tạm thời</li>
          <li>Hệ thống sẽ yêu cầu bạn tạo mật khẩu mới</li>
          <li>Tạo mật khẩu mạnh:
            <ul>
              <li>Tối thiểu 12 ký tự</li>
              <li>Bao gồm chữ hoa, chữ thường</li>
              <li>Bao gồm số và ký tự đặc biệt</li>
            </ul>
          </li>
          <li>Sau khi đổi mật khẩu thành công, bạn có thể bắt đầu sử dụng hệ thống</li>
        </ol>
      </div>

      <p>Nếu bạn gặp bất kỳ vấn đề gì hoặc cần hỗ trợ, vui lòng liên hệ với quản trị viên.</p>

      <p>Chúc bạn có trải nghiệm tốt với hệ thống!</p>

      <p>Trân trọng,<br/><strong>Lock & Lock Product Management Team</strong></p>
    </div>

    <div class="footer">
      <p>Email này được gửi tự động. Vui lòng không trả lời email này.</p>
      <p>&copy; 2025 Lock & Lock Product Management System</p>
    </div>
  </div>
</body>
</html>',
 'Chào mừng {{user_name}},

Tài khoản của bạn đã được tạo thành công!

📧 Email/Username: {{user_email}}
🔑 Mật khẩu tạm thời: {{temp_password}}

⚠️ LƯU Ý QUAN TRỌNG:
- Đây là mật khẩu tạm thời
- Bạn SẼ BỊ BẮT BUỘC đổi mật khẩu khi đăng nhập lần đầu
- Vui lòng không chia sẻ thông tin này với bất kỳ ai

🔗 Đăng nhập tại: {{login_url}}

📋 Hướng dẫn:
1. Truy cập link đăng nhập
2. Nhập email và mật khẩu tạm thời
3. Hệ thống sẽ yêu cầu bạn tạo mật khẩu mới
4. Tạo mật khẩu mạnh (tối thiểu 12 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt)

Nếu cần hỗ trợ, vui lòng liên hệ Admin.

---
Lock & Lock Product Management Team',
 '["user_name", "user_email", "temp_password", "login_url"]'::jsonb
),

-- Template 2: Account Approved
('account_approved',
 'Account Approved Notification',
 'Email sent when user account is approved by admin',
 'Tài khoản của bạn đã được kích hoạt',
 '<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e0e0e0; }
    .button { display: inline-block; background: #11998e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Tài khoản đã được kích hoạt</h1>
    </div>
    <div class="content">
      <p>Xin chào <strong>{{user_name}}</strong>,</p>
      <p>Tin tốt! Tài khoản của bạn đã được quản trị viên phê duyệt và kích hoạt.</p>
      <p>Bây giờ bạn có thể đăng nhập và sử dụng đầy đủ các tính năng của hệ thống.</p>
      <div style="text-align: center;">
        <a href="{{login_url}}" class="button">Đăng nhập ngay</a>
      </div>
      <p>Trân trọng,<br/><strong>Lock & Lock Team</strong></p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Lock & Lock Product Management System</p>
    </div>
  </div>
</body>
</html>',
 'Xin chào {{user_name}},

Tài khoản của bạn đã được quản trị viên phê duyệt và kích hoạt.

Bạn có thể đăng nhập tại: {{login_url}}

Trân trọng,
Lock & Lock Team',
 '["user_name", "user_email", "login_url"]'::jsonb
),

-- Template 3: Password Reset
('password_reset',
 'Password Reset Request',
 'Email sent when user requests password reset',
 'Yêu cầu đặt lại mật khẩu',
 '<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #e0e0e0; }
    .button { display: inline-block; background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; color: #666; font-size: 12px; padding: 20px; }
    .warning { background: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Đặt lại mật khẩu</h1>
    </div>
    <div class="content">
      <p>Xin chào <strong>{{user_name}}</strong>,</p>
      <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
      <div style="text-align: center;">
        <a href="{{reset_url}}" class="button">Đặt lại mật khẩu</a>
      </div>
      <div class="warning">
        <p><strong>⚠️ Lưu ý:</strong></p>
        <ul>
          <li>Link này chỉ có hiệu lực trong <strong>1 giờ</strong></li>
          <li>Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này</li>
        </ul>
      </div>
      <p>Trân trọng,<br/><strong>Lock & Lock Team</strong></p>
    </div>
    <div class="footer">
      <p>&copy; 2025 Lock & Lock Product Management System</p>
    </div>
  </div>
</body>
</html>',
 'Xin chào {{user_name}},

Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.

Đặt lại mật khẩu tại: {{reset_url}}

⚠️ Lưu ý:
- Link này chỉ có hiệu lực trong 1 giờ
- Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này

Trân trọng,
Lock & Lock Team',
 '["user_name", "user_email", "reset_url"]'::jsonb
);

-- Add comments
COMMENT ON TABLE email_templates IS 'Email template storage with variable interpolation support';
COMMENT ON COLUMN email_templates.template_key IS 'Unique identifier for template lookup';
COMMENT ON COLUMN email_templates.available_variables IS 'JSON array of variable names available for this template';

-- Create index for faster template lookup
CREATE INDEX IF NOT EXISTS idx_email_templates_key ON email_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active) WHERE is_active = TRUE;

-- ================================================================
-- TABLE 3: EMAIL LOGS (Optional - for tracking)
-- ================================================================

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Recipient info
  recipient_email VARCHAR(255) NOT NULL,
  recipient_name VARCHAR(255),

  -- Email details
  template_key VARCHAR(100),
  subject TEXT,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  -- Status values: 'queued', 'sending', 'sent', 'failed', 'bounced'

  provider_used VARCHAR(50),

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE email_logs IS 'Email sending history and status tracking';
COMMENT ON COLUMN email_logs.status IS 'Email status: queued, sending, sent, failed, bounced';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_template ON email_logs(template_key);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Email Settings: Only admins can view/edit
CREATE POLICY "Admins can manage email settings"
  ON email_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = TRUE
    )
  );

-- Email Templates: Only admins can manage
CREATE POLICY "Admins can manage email templates"
  ON email_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = TRUE
    )
  );

-- Email Logs: Admins can view all, users can view their own
CREATE POLICY "Admins can view all email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.is_active = TRUE
    )
  );

CREATE POLICY "Users can view their own email logs"
  ON email_logs
  FOR SELECT
  TO authenticated
  USING (
    recipient_email = (
      SELECT email FROM user_profiles
      WHERE id = auth.uid()
    )
  );

-- ================================================================
-- HELPER FUNCTIONS
-- ================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_email_settings_updated_at
  BEFORE UPDATE ON email_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_logs_updated_at
  BEFORE UPDATE ON email_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- VERIFICATION QUERIES (Run these to verify)
-- ================================================================

-- Check email_settings
-- SELECT * FROM email_settings;

-- Check email_templates
-- SELECT template_key, template_name, is_active FROM email_templates;

-- Check email_logs
-- SELECT COUNT(*) FROM email_logs;

-- ================================================================
-- END OF MIGRATION
-- ================================================================
