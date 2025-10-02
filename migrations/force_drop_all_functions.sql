-- =====================================================
-- FORCE DROP ALL FUNCTIONS - No matter what signature
-- =====================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Drop all functions matching these names
    FOR func_record IN
        SELECT
            n.nspname as schema_name,
            p.proname as function_name,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname IN (
            'get_user_project_role',
            'get_user_project_permissions',
            'can_user_manage_members',
            'get_project_member_count',
            'get_project_members_for_user',
            'add_project_member'
          )
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
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

SELECT '✅ All functions dropped' as status;

-- =====================================================
-- Now recreate with correct signatures
-- =====================================================

-- Function 1: Get user's role in a project
CREATE FUNCTION get_user_project_role(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR;
  v_is_admin BOOLEAN;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_is_admin THEN
    RETURN 'admin';
  END IF;

  SELECT role INTO v_role
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND status = 'active';

  RETURN COALESCE(v_role, 'none');
END;
$$;

-- Function 2: Get user's permissions
CREATE FUNCTION get_user_project_permissions(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role VARCHAR;
  v_default_permissions JSONB;
  v_custom_permissions JSONB;
BEGIN
  v_role := get_user_project_role(p_project_id, p_user_id);

  IF v_role = 'none' THEN
    RETURN '{"can_manage_members": false, "can_edit_project": false, "can_delete_project": false, "can_manage_woocommerce": false, "can_edit_products": false, "can_view_analytics": false}'::JSONB;
  END IF;

  SELECT default_permissions INTO v_default_permissions
  FROM project_roles
  WHERE name = v_role;

  SELECT COALESCE(permissions, '{}'::JSONB) INTO v_custom_permissions
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND status = 'active';

  RETURN v_default_permissions || COALESCE(v_custom_permissions, '{}'::JSONB);
END;
$$;

-- Function 3: Check if user can manage members
CREATE FUNCTION can_user_manage_members(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_system_admin BOOLEAN;
  v_project_role VARCHAR;
BEGIN
  SELECT (role = 'admin') INTO v_is_system_admin
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_is_system_admin THEN
    RETURN TRUE;
  END IF;

  SELECT role INTO v_project_role
  FROM project_members
  WHERE project_id = p_project_id
    AND user_id = p_user_id
    AND status = 'active';

  RETURN v_project_role IN ('admin', 'manager');
END;
$$;

-- Function 4: Get member count
CREATE FUNCTION get_project_member_count(
  p_project_id INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM project_members
    WHERE project_id = p_project_id
      AND status = 'active'
  );
END;
$$;

-- Function 5: Get project members for user
CREATE FUNCTION get_project_members_for_user(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS TABLE (
  id UUID,
  project_id INTEGER,
  user_id UUID,
  role VARCHAR,
  status VARCHAR,
  invited_by UUID,
  assigned_at TIMESTAMP,
  updated_at TIMESTAMP,
  permissions JSONB,
  notes TEXT,
  created_at TIMESTAMP,
  user_email TEXT,
  user_full_name TEXT,
  user_system_role VARCHAR,
  user_is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT (role = 'admin') INTO v_is_admin
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_is_admin THEN
    RETURN QUERY
    SELECT
      pm.id, pm.project_id, pm.user_id, pm.role, pm.status,
      pm.invited_by, pm.assigned_at, pm.updated_at, pm.permissions,
      pm.notes, pm.created_at,
      up.email::TEXT, up.full_name::TEXT, up.role::VARCHAR, up.is_active
    FROM project_members pm
    JOIN user_profiles up ON pm.user_id = up.id
    WHERE pm.project_id = p_project_id AND pm.status = 'active'
    ORDER BY pm.assigned_at DESC;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = p_user_id AND status = 'active'
  ) THEN
    RETURN QUERY
    SELECT
      pm.id, pm.project_id, pm.user_id, pm.role, pm.status,
      pm.invited_by, pm.assigned_at, pm.updated_at, pm.permissions,
      pm.notes, pm.created_at,
      up.email::TEXT, up.full_name::TEXT, up.role::VARCHAR, up.is_active
    FROM project_members pm
    JOIN user_profiles up ON pm.user_id = up.id
    WHERE pm.project_id = p_project_id AND pm.status = 'active'
    ORDER BY pm.assigned_at DESC;
  END IF;

  RETURN;
END;
$$;

-- Function 6: Add project member
CREATE FUNCTION add_project_member(
  p_project_id INTEGER,
  p_user_id UUID,
  p_role VARCHAR,
  p_invited_by UUID,
  p_permissions JSONB DEFAULT '{}'::JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_can_manage BOOLEAN;
  v_new_member_id UUID;
BEGIN
  SELECT can_user_manage_members(p_project_id, p_invited_by) INTO v_can_manage;

  IF NOT v_can_manage THEN
    RAISE EXCEPTION 'User does not have permission to add members to this project';
  END IF;

  SELECT id INTO v_new_member_id
  FROM project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;

  IF v_new_member_id IS NOT NULL THEN
    RAISE EXCEPTION 'User is already a member of this project';
  END IF;

  INSERT INTO project_members (
    project_id, user_id, role, status, invited_by, assigned_at, permissions
  ) VALUES (
    p_project_id, p_user_id, p_role, 'active', p_invited_by, NOW(), p_permissions
  )
  RETURNING id INTO v_new_member_id;

  RETURN v_new_member_id;
END;
$$;

SELECT '✅ All 6 functions recreated with correct signatures!' as result;
