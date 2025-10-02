-- =====================================================
-- DROP ALL OLD FUNCTIONS
-- Chạy script này TRƯỚC KHI chạy comprehensive_fix_v3
-- Xóa tất cả versions cũ của functions
-- =====================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Loop through all functions matching our names
    FOR func_record IN
        SELECT
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'get_project_members_for_user',
            'get_available_users_for_project',
            'get_user_project_permissions',
            'get_user_project_role',
            'can_user_manage_members',
            'add_project_member',
            'get_project_member_count'
          )
    LOOP
        EXECUTE format(
            'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
            func_record.schema_name,
            func_record.function_name,
            func_record.args
        );
        RAISE NOTICE 'Dropped function: %.%(%)',
            func_record.schema_name,
            func_record.function_name,
            func_record.args;
    END LOOP;
END $$;

-- Verify all functions are dropped
SELECT
  COUNT(*) as remaining_functions,
  CASE
    WHEN COUNT(*) = 0 THEN '✅ All old functions dropped successfully!'
    ELSE '⚠️ Some functions still exist - check manually'
  END as status
FROM pg_proc
WHERE proname IN (
  'get_project_members_for_user',
  'get_available_users_for_project',
  'get_user_project_permissions',
  'get_user_project_role',
  'can_user_manage_members',
  'add_project_member',
  'get_project_member_count'
)
AND pronamespace = 'public'::regnamespace;

SELECT '✅ Ready to run comprehensive_fix_v3_no_notes.sql' as next_step;
