-- Safe final setup - xử lý existing tables

-- 1. Drop và recreate tables để đảm bảo structure đúng
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS product_updates CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- 2. Tạo products table
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT,
  name TEXT,
  price DECIMAL(10,2),
  stock_quantity INTEGER,
  status TEXT DEFAULT 'publish',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo product_updates table
CREATE TABLE product_updates (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT,
  sku TEXT,
  name TEXT,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  old_stock INTEGER,
  new_stock INTEGER,
  change_type TEXT DEFAULT 'update',
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tạo system_settings table
CREATE TABLE system_settings (
  id BIGSERIAL PRIMARY KEY,
  category TEXT UNIQUE NOT NULL,
  config_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. DISABLE RLS hoàn toàn
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE product_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- 6. Grant full permissions
GRANT ALL ON products TO authenticated;
GRANT ALL ON product_updates TO authenticated;
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON products TO service_role;
GRANT ALL ON product_updates TO service_role;
GRANT ALL ON system_settings TO service_role;

-- Grant on sequences
GRANT ALL ON products_id_seq TO authenticated;
GRANT ALL ON product_updates_id_seq TO authenticated;
GRANT ALL ON system_settings_id_seq TO authenticated;
GRANT ALL ON products_id_seq TO service_role;
GRANT ALL ON product_updates_id_seq TO service_role;
GRANT ALL ON system_settings_id_seq TO service_role;

-- 7. Insert test data với correct structure
INSERT INTO product_updates (sku, name, change_type, status, created_at)
VALUES ('TEST-001', 'Test Product', 'create', 'completed', NOW());

-- 8. Show kết quả
SELECT 'Tables recreated successfully' as status;
SELECT COUNT(*) as product_updates_count FROM product_updates;
SELECT COUNT(*) as products_count FROM products;
SELECT COUNT(*) as system_settings_count FROM system_settings;

-- 9. Show table structure
SELECT 'product_updates columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'product_updates'
ORDER BY ordinal_position;