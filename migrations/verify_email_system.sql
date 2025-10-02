-- ================================================================
-- VERIFICATION SCRIPT FOR EMAIL SYSTEM
-- ================================================================
-- Run these queries after migration to verify everything is OK

-- 1. Check if email_settings table exists and has default config
SELECT 'email_settings' as table_name,
       COUNT(*) as row_count,
       provider,
       is_enabled,
       from_email
FROM email_settings
GROUP BY provider, is_enabled, from_email;

-- Expected: 1 row with provider='supabase', is_enabled=true

-- 2. Check if email_templates table exists and has default templates
SELECT 'email_templates' as table_name,
       COUNT(*) as total_templates,
       COUNT(*) FILTER (WHERE is_active = true) as active_templates
FROM email_templates;

-- Expected: 3 total templates (new_user_credentials, account_approved, password_reset)

-- 3. List all email templates
SELECT template_key,
       template_name,
       is_active,
       array_length(available_variables::text[], 1) as variable_count
FROM email_templates
ORDER BY template_name;

-- 4. Check if email_logs table exists
SELECT 'email_logs' as table_name,
       COUNT(*) as row_count
FROM email_logs;

-- Expected: 0 rows (empty table)

-- 5. Check table structures
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name IN ('email_settings', 'email_templates', 'email_logs')
ORDER BY table_name, ordinal_position;

-- 6. Check indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('email_settings', 'email_templates', 'email_logs')
ORDER BY tablename, indexname;

-- 7. Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('email_settings', 'email_templates', 'email_logs')
ORDER BY tablename, policyname;

-- 8. Test template variable interpolation (preview)
SELECT template_key,
       regexp_matches(body_html, '\{\{([^}]+)\}\}', 'g') as found_variables
FROM email_templates
WHERE template_key = 'new_user_credentials'
LIMIT 10;

-- Expected: Should find variables like user_name, user_email, temp_password, login_url

-- 9. Check if triggers are created
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table IN ('email_settings', 'email_templates', 'email_logs')
ORDER BY event_object_table, trigger_name;

-- Expected: update_*_updated_at triggers

-- 10. Summary report
SELECT
  'Migration Status' as check_type,
  CASE
    WHEN EXISTS (SELECT 1 FROM email_settings) AND
         EXISTS (SELECT 1 FROM email_templates) AND
         EXISTS (SELECT 1 FROM email_logs)
    THEN '✅ SUCCESS - All tables created'
    ELSE '❌ FAILED - Some tables missing'
  END as status;

-- ================================================================
-- END OF VERIFICATION
-- ================================================================
