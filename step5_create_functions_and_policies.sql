-- ====================================
-- BƯỚC 5: TẠO FUNCTIONS VÀ RLS POLICIES
-- ====================================

-- 5.1. Tạo function kiểm tra quyền truy cập project
CREATE OR REPLACE FUNCTION user_can_access_project(user_uuid UUID, project_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    user_role_val user_role;
    is_member BOOLEAN;
BEGIN
    -- Lấy role của user
    SELECT role INTO user_role_val FROM user_profiles WHERE id = user_uuid;

    -- Admin có thể truy cập tất cả
    IF user_role_val = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Kiểm tra xem user có phải member của project không
    SELECT EXISTS(
        SELECT 1 FROM project_members
        WHERE user_id = user_uuid
        AND project_id = project_uuid
        AND is_active = TRUE
    ) INTO is_member;

    -- Hoặc là owner/manager của project
    IF NOT is_member THEN
        SELECT EXISTS(
            SELECT 1 FROM projects
            WHERE id = project_uuid
            AND (owner_id = user_uuid OR manager_id = user_uuid)
        ) INTO is_member;
    END IF;

    RETURN is_member;
END;
$$ LANGUAGE plpgsql;

-- 5.2. Enable RLS cho các bảng mới
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- 5.3. Tạo RLS policies cho project_members
-- Users can view project members of their projects
CREATE POLICY "Users can view project members of their projects" ON project_members
    FOR SELECT USING (
        auth.uid() IN (
            -- User là member của project
            SELECT user_id FROM project_members pm2 WHERE pm2.project_id = project_members.project_id
            UNION
            -- Hoặc là admin
            SELECT id FROM user_profiles WHERE id = auth.uid() AND role = 'admin'
            UNION
            -- Hoặc là owner/manager của project
            SELECT owner_id FROM projects p WHERE p.id = project_members.project_id
            UNION
            SELECT manager_id FROM projects p WHERE p.id = project_members.project_id
        )
    );

-- Managers can manage their project members
CREATE POLICY "Managers can manage their project members" ON project_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND (
                up.role = 'admin'
                OR (
                    up.role = 'manager'
                    AND project_members.project_id IN (
                        SELECT p.id FROM projects p
                        WHERE p.owner_id = auth.uid() OR p.manager_id = auth.uid()
                    )
                )
            )
        )
    );

-- 5.4. Tạo RLS policies cho user_activity_logs
-- Users can view their own activity logs
CREATE POLICY "Users can view their own activity logs" ON user_activity_logs
    FOR SELECT USING (user_id = auth.uid());

-- Admins can view all activity logs
CREATE POLICY "Admins can view all activity logs" ON user_activity_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- COMPLETED: ✅ Bước 5 hoàn thành
SELECT '✅ BƯỚC 5: Tạo functions và RLS policies - HOÀN THÀNH' as status;