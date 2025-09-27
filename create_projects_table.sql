-- Tạo projects table nếu chưa có

-- 1. Tạo projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT UNIQUE NOT NULL,
  woocommerce_base_url TEXT NOT NULL,
  products_table TEXT DEFAULT 'products',
  audit_table TEXT DEFAULT 'product_updates',
  settings JSONB DEFAULT '{}',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tạo indexes cho performance
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);

-- 3. Tạo RLS policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies nếu có
DROP POLICY IF EXISTS "Users can view projects they own" ON projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON projects;
DROP POLICY IF EXISTS "Admins can manage all projects" ON projects;

-- Tạo policies mới
CREATE POLICY "Users can view projects they own" ON projects
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create their own projects" ON projects
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own projects" ON projects
  FOR UPDATE
  USING (owner_id = auth.uid());

-- Admins có thể view/manage tất cả projects
CREATE POLICY "Admins can view all projects" ON projects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );

CREATE POLICY "Admins can manage all projects" ON projects
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
    )
  );

-- 4. Tạo function để auto-update updated_at
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Tạo trigger
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE PROCEDURE update_projects_updated_at();

-- 6. Grant permissions
GRANT ALL ON projects TO authenticated;
GRANT ALL ON projects TO service_role;

-- Check results
SELECT 'Projects table created successfully' as status;
SELECT COUNT(*) as existing_projects FROM projects;