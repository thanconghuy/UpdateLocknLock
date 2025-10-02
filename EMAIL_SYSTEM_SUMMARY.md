# 📧 Email System - Tổng Kết Thiết Kế

## ✅ Vấn Đề Đã Giải Quyết

### 1. **Lỗi Duplicate Template Key**
- ❌ **Vấn đề cũ**: Migration insert hardcoded templates vào DB → Lỗi duplicate khi chạy lại
- ✅ **Giải pháp mới**: 
  - Chỉ tạo table structure (không INSERT data)
  - Templates được quản lý qua UI
  - Default templates hardcoded trong code như **fallback**

### 2. **Flexibility & Maintenance**
- ✅ Admin có thể tạo/sửa templates qua UI
- ✅ Không cần developer để thay đổi nội dung email
- ✅ Preview trước khi lưu
- ✅ Dễ dàng thêm templates mới

## 🏗️ Kiến Trúc Email System

### Database (Supabase)
```
┌─────────────────────┐
│  email_settings     │  ← SMTP config, provider settings
├─────────────────────┤
│  email_templates    │  ← Templates created via UI
├─────────────────────┤
│  email_logs         │  ← Sending history & tracking
└─────────────────────┘
```

### Application Layer
```
EmailService (Main orchestrator)
  ├─ EmailConfigService (Config management)
  ├─ EmailTemplateService (Template CRUD + Rendering)
  │   └─ getDefaultTemplate() ← Hardcoded fallbacks
  └─ EmailProviders
      ├─ SupabaseEmailProvider
      └─ SMTPProvider
```

## 🎯 Fallback Strategy

**Priority Order:**
1. **DB Template** (if exists) → Use this
2. **Hardcoded Default** (if DB fails) → Use fallback
3. **Error** (if both fail) → Return error

**Example Flow:**
```typescript
// EmailTemplateService.getTemplate()
try {
  // 1. Check cache
  if (cached) return cached
  
  // 2. Try DB
  const dbTemplate = await supabase.from('email_templates')...
  if (dbTemplate) return dbTemplate
  
  // 3. Fallback to default
  const defaultTemplate = this.getDefaultTemplate(key)
  if (defaultTemplate) return defaultTemplate
  
  // 4. Error
  return { success: false, error: 'Template not found' }
}
```

## 📁 Files Structure

```
src/services/email/
├── EmailService.ts              # Main service
├── EmailConfigService.ts        # Config management
├── EmailTemplateService.ts      # ⭐ Templates + Defaults
├── providers/
│   ├── BaseEmailProvider.ts
│   ├── SupabaseEmailProvider.ts
│   └── SMTPProvider.ts

migrations/
├── create_email_system.sql      # Full migration (with data)
└── create_email_tables_only.sql # ⭐ NEW: Tables only
```

## 🚀 Migration Instructions

### Option 1: Tables Only (Recommended)
```sql
-- File: migrations/create_email_tables_only.sql
-- Chỉ tạo tables, không INSERT data
-- Templates sẽ tạo qua UI sau
```

**Steps:**
1. Mở Supabase SQL Editor
2. Copy `create_email_tables_only.sql`
3. Run → Done!

### Option 2: Full Migration (With Default Templates)
```sql
-- File: migrations/create_email_system.sql
-- Tạo tables + INSERT default templates
-- ⚠️ Chỉ chạy 1 lần, không chạy lại!
```

## 🎨 Next Steps: Email Management UI

### Planned Features:

#### 1. Email Settings Module
- [ ] SMTP Configuration Form
- [ ] Provider Selection (Supabase/SendGrid/Custom)
- [ ] Test Email Connection
- [ ] Enable/Disable Email System

#### 2. Template Management Module
```
Admin Settings > Email Management > Templates

┌──────────────────────────────────────┐
│ 📝 Email Templates                   │
├──────────────────────────────────────┤
│  ┌────────────────────────────────┐  │
│  │ ✉️ New User Credentials        │  │
│  │ Subject: Chào mừng...          │  │
│  │ [Edit] [Preview] [Duplicate]   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ✅ Account Approved            │  │
│  │ Subject: Tài khoản...          │  │
│  │ [Edit] [Preview] [Duplicate]   │  │
│  └────────────────────────────────┘  │
│                                      │
│  [+ Create New Template]             │
└──────────────────────────────────────┘
```

#### 3. Template Editor
- Rich Text Editor (với HTML support)
- Variable Insertion: `{{user_name}}`, `{{login_url}}`
- Live Preview (với sample data)
- HTML/Text toggle
- Save Draft / Publish

#### 4. Email Logs Viewer
- Sent email history
- Status tracking (queued/sent/failed)
- Filter by recipient, date, template
- Retry failed emails

## 📊 Default Templates (Hardcoded Fallbacks)

### 1. `new_user_credentials`
**Khi dùng**: Tạo user mới với auto-generated password
**Variables**: `user_name`, `user_email`, `temp_password`, `login_url`

### 2. `account_approved`
**Khi dùng**: Admin activate user
**Variables**: `user_name`, `user_email`, `login_url`

### 3. `password_reset`
**Khi dùng**: User request reset password
**Variables**: `user_name`, `user_email`, `reset_url`

### 4. `welcome_user`
**Khi dùng**: General welcome email
**Variables**: `user_name`

## ✅ Current Status

- [x] Email system architecture designed
- [x] Default templates in code (fallback)
- [x] Migration script (tables only)
- [x] UserDataService integration
- [x] Auto-send on user creation
- [x] Auto-send on user activation
- [ ] Email Management UI (Next sprint)
- [ ] Template Editor UI (Next sprint)
- [ ] Email Logs Viewer (Next sprint)

## 🎯 Benefits of This Approach

1. **No More Duplicate Errors**: Templates in DB are optional
2. **Zero Downtime**: System works even if DB migration pending
3. **Flexible**: Admin can customize via UI later
4. **Maintainable**: No SQL scripts for content updates
5. **Scalable**: Easy to add new templates

---

**Tác giả**: Claude + User Collaboration  
**Ngày**: 2025-10-01  
**Version**: 2.0 - UI-First Approach
