// ================================================================
// EMAIL SYSTEM TYPES & INTERFACES
// ================================================================

// ----------------------------------------------------------------
// EMAIL PROVIDERS
// ----------------------------------------------------------------

export type EmailProvider = 'supabase' | 'sendgrid' | 'resend' | 'custom_smtp'

export type EmailStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'bounced'

// ----------------------------------------------------------------
// EMAIL CONFIGURATION
// ----------------------------------------------------------------

export interface EmailSettings {
  id: string
  provider: EmailProvider
  is_enabled: boolean

  // SMTP Configuration
  smtp_host?: string
  smtp_port?: number
  smtp_username?: string
  smtp_password?: string
  smtp_secure?: boolean

  // SendGrid Config
  sendgrid_api_key?: string

  // Resend Config
  resend_api_key?: string

  // Email defaults
  from_email: string
  from_name: string
  reply_to_email?: string

  // Settings
  max_retry_attempts: number
  retry_delay_seconds: number

  // Metadata
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface UpdateEmailSettingsRequest {
  provider?: EmailProvider
  is_enabled?: boolean

  smtp_host?: string
  smtp_port?: number
  smtp_username?: string
  smtp_password?: string
  smtp_secure?: boolean

  sendgrid_api_key?: string
  resend_api_key?: string

  from_email?: string
  from_name?: string
  reply_to_email?: string

  max_retry_attempts?: number
  retry_delay_seconds?: number
}

// ----------------------------------------------------------------
// EMAIL TEMPLATES
// ----------------------------------------------------------------

export type EmailTemplateKey =
  | 'new_user_credentials'
  | 'account_approved'
  | 'password_reset'
  | 'welcome_user'
  | 'email_confirmation'

export interface EmailTemplate {
  id: string
  template_key: EmailTemplateKey
  template_name: string
  description?: string
  subject: string
  body_html: string
  body_text?: string
  available_variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
  updated_by?: string
}

export interface CreateEmailTemplateRequest {
  template_key: EmailTemplateKey
  template_name: string
  description?: string
  subject: string
  body_html: string
  body_text?: string
  available_variables?: string[]
  is_active?: boolean
}

export interface UpdateEmailTemplateRequest {
  template_name?: string
  description?: string
  subject?: string
  body_html?: string
  body_text?: string
  available_variables?: string[]
  is_active?: boolean
}

// ----------------------------------------------------------------
// EMAIL SENDING
// ----------------------------------------------------------------

export interface SendEmailRequest {
  to: string
  to_name?: string
  subject: string
  html?: string
  text?: string
  template_key?: EmailTemplateKey
  template_variables?: Record<string, string>
  reply_to?: string
}

export interface SendEmailResponse {
  success: boolean
  message_id?: string
  error?: string
}

// ----------------------------------------------------------------
// EMAIL LOGS
// ----------------------------------------------------------------

export interface EmailLog {
  id: string
  recipient_email: string
  recipient_name?: string
  template_key?: string
  subject?: string
  status: EmailStatus
  provider_used?: string
  error_message?: string
  retry_count: number
  sent_at?: string
  created_at: string
  updated_at: string
}

export interface EmailLogQueryParams {
  recipient_email?: string
  status?: EmailStatus
  template_key?: string
  limit?: number
  offset?: number
  from_date?: string
  to_date?: string
}

// ----------------------------------------------------------------
// EMAIL SERVICE RESPONSES
// ----------------------------------------------------------------

export interface OperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

// ----------------------------------------------------------------
// EMAIL PROVIDER INTERFACE
// ----------------------------------------------------------------

export interface IEmailProvider {
  name: EmailProvider
  isConfigured(): Promise<boolean>
  send(request: SendEmailRequest): Promise<SendEmailResponse>
  testConnection(): Promise<{ success: boolean; error?: string }>
}

// ----------------------------------------------------------------
// EMAIL TEMPLATE VARIABLES
// ----------------------------------------------------------------

export interface NewUserCredentialsVariables {
  user_name: string
  user_email: string
  temp_password: string
  login_url: string
}

export interface AccountApprovedVariables {
  user_name: string
  user_email: string
  login_url: string
}

export interface PasswordResetVariables {
  user_name: string
  user_email: string
  reset_url: string
}

export type EmailTemplateVariables =
  | NewUserCredentialsVariables
  | AccountApprovedVariables
  | PasswordResetVariables
  | Record<string, string>
