-- ====================================
-- BƯỚC 4: CẬP NHẬT BẢNG PROJECTS
-- ====================================

-- Thêm các column mới cho projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES user_profiles(id),
ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 5;

-- Nếu chưa có column is_active, thêm vào
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Tạo index cho performance
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(is_active);

-- Set default manager_id = owner_id nếu chưa có
UPDATE projects
SET manager_id = owner_id
WHERE manager_id IS NULL;

-- COMPLETED: ✅ Bước 4 hoàn thành
SELECT '✅ BƯỚC 4: Cập nhật bảng projects - HOÀN THÀNH' as status;