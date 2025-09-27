-- Simple projects table setup - no complex RLS policies

-- 1. Drop existing table if any issues
DROP TABLE IF EXISTS projects CASCADE;

-- 2. Create simple projects table
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT,
  woocommerce_base_url TEXT NOT NULL,
  products_table TEXT DEFAULT 'products',
  audit_table TEXT DEFAULT 'product_updates',
  settings JSONB DEFAULT '{}',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create basic index
CREATE INDEX idx_projects_owner_id ON projects(owner_id);

-- 4. Enable RLS with VERY simple policies
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 5. Create simple policies that allow everything for authenticated users
CREATE POLICY "Authenticated users can do everything" ON projects
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Grant permissions
GRANT ALL ON projects TO authenticated;
GRANT ALL ON projects TO service_role;

-- 7. Test the table
INSERT INTO projects (name, slug, woocommerce_base_url, owner_id)
VALUES (
  'Test Project',
  'test-project-' || extract(epoch from now()),
  'https://example.com',
  (SELECT id FROM auth.users LIMIT 1)
);

-- 8. Show results
SELECT 'Projects table created successfully' as status;
SELECT COUNT(*) as project_count FROM projects;
SELECT * FROM projects ORDER BY created_at DESC LIMIT 3;