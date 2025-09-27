-- Minimal setup - chỉ tạo những gì cần thiết để app hoạt động

-- 1. Tạo products table (simple)
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT,
  name TEXT,
  price DECIMAL(10,2),
  stock_quantity INTEGER,
  status TEXT DEFAULT 'publish',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tạo product_updates table (simple)
CREATE TABLE IF NOT EXISTS product_updates (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT,
  sku TEXT,
  name TEXT,
  change_type TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo system_settings table (simple)
CREATE TABLE IF NOT EXISTS system_settings (
  id BIGSERIAL PRIMARY KEY,
  category TEXT UNIQUE NOT NULL,
  config_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Disable RLS temporarily để test
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- 5. Grant full access
GRANT ALL ON products TO authenticated;
GRANT ALL ON product_updates TO authenticated;
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON products TO service_role;
GRANT ALL ON product_updates TO service_role;
GRANT ALL ON system_settings TO service_role;

-- 6. Insert một record test để đảm bảo table hoạt động
INSERT INTO product_updates (sku, name, change_type, status)
VALUES ('TEST-001', 'Test Product', 'create', 'completed')
ON CONFLICT DO NOTHING;

-- 7. Show final status
SELECT 'Setup completed - RLS disabled for testing' as status;

SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('products', 'product_updates', 'system_settings', 'projects', 'user_profiles')
ORDER BY table_name;