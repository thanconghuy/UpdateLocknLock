-- Ultra simple setup - bare minimum để app hoạt động

-- 1. Tạo products table đơn giản nhất
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tạo product_updates table đơn giản nhất
CREATE TABLE IF NOT EXISTS product_updates (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo system_settings table đơn giản nhất
CREATE TABLE IF NOT EXISTS system_settings (
  id BIGSERIAL PRIMARY KEY,
  category TEXT,
  config_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tắt RLS hoàn toàn
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- 5. Grant toàn quyền
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 6. Insert test data
INSERT INTO product_updates (sku, status, created_at)
VALUES ('TEST', 'completed', NOW());

-- 7. Show kết quả
SELECT COUNT(*) as product_updates_count FROM product_updates;
SELECT 'Setup completed successfully' as status;