-- ====================================
-- BƯỚC 2: CẬP NHẬT BẢNG USER_PROFILES
-- ====================================

-- Thêm các column mới cho user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS max_projects INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_team_members INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES user_profiles(id);

-- Cập nhật last_active_at cho user hiện tại
UPDATE user_profiles
SET last_active_at = NOW()
WHERE last_active_at IS NULL;

-- Set default limits cho manager role
UPDATE user_profiles
SET
    max_projects = 10,
    max_team_members = 5
WHERE role = 'manager' AND max_projects IS NULL;

-- Tạo index cho performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_active ON user_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_profiles_suspended ON user_profiles(is_suspended);

-- COMPLETED: ✅ Bước 2 hoàn thành
SELECT '✅ BƯỚC 2: Cập nhật user_profiles - HOÀN THÀNH' as status;