-- =====================================================
-- FIX: add_project_member - Support restore removed users
-- =====================================================
-- Nếu user đã tồn tại với status='removed' → Restore thay vì insert mới
-- =====================================================

CREATE OR REPLACE FUNCTION add_project_member(
  p_project_id INTEGER,
  p_user_id UUID,
  p_role VARCHAR(50),
  p_requesting_user_id UUID,
  p_custom_permissions JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_requesting_user_level INTEGER;
  v_new_role_level INTEGER;
  v_existing_member_id UUID;
  v_existing_status VARCHAR;
BEGIN
  -- 1. Permission check
  SELECT pr.level INTO v_requesting_user_level
  FROM project_members pm
  JOIN project_roles pr ON pm.role = pr.name
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_requesting_user_id
    AND pm.status = 'active';

  -- Nếu không tìm thấy, check xem user có phải system admin không
  IF v_requesting_user_level IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin') THEN
      RAISE EXCEPTION 'Permission denied: You cannot add members to this project';
    END IF;
    v_requesting_user_level := 100; -- Admin level
  END IF;

  -- 2. Validate role level (không được assign role cao hơn role của mình)
  SELECT level INTO v_new_role_level
  FROM project_roles
  WHERE name = p_role;

  IF v_new_role_level > v_requesting_user_level THEN
    RAISE EXCEPTION 'Cannot assign role higher than your own role';
  END IF;

  -- 3. Check if user already exists in project_members
  SELECT id, status INTO v_existing_member_id, v_existing_status
  FROM project_members
  WHERE project_id = p_project_id AND user_id = p_user_id;

  -- 4a. If exists with status='removed' or 'suspended' → RESTORE
  IF v_existing_member_id IS NOT NULL AND v_existing_status != 'active' THEN
    UPDATE project_members
    SET
      role = p_role,
      status = 'active',
      permissions = p_custom_permissions,
      updated_at = NOW()
    WHERE id = v_existing_member_id;

    RAISE NOTICE 'User restored to project with role %', p_role;
    RETURN v_existing_member_id;

  -- 4b. If exists with status='active' → ERROR
  ELSIF v_existing_member_id IS NOT NULL AND v_existing_status = 'active' THEN
    RAISE EXCEPTION 'User is already an active member of this project';

  -- 4c. If not exists → INSERT NEW
  ELSE
    INSERT INTO project_members (
      project_id,
      user_id,
      role,
      status,
      permissions,
      invited_by,
      created_at,
      updated_at
    )
    VALUES (
      p_project_id,
      p_user_id,
      p_role,
      'active',
      p_custom_permissions,
      p_requesting_user_id,
      NOW(),
      NOW()
    )
    RETURNING id INTO v_existing_member_id;

    RAISE NOTICE 'User added to project with role %', p_role;
    RETURN v_existing_member_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION add_project_member TO authenticated;

SELECT '✅ Fixed: add_project_member (support restore removed users)' as status;
