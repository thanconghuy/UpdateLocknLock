-- Tạo tất cả các tables cần thiết cho app

-- 1. Tạo products table
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

-- 2. Tạo product_updates table (audit log)
CREATE TABLE IF NOT EXISTS product_updates (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT,
  sku TEXT,
  name TEXT,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  old_stock INTEGER,
  new_stock INTEGER,
  change_type TEXT, -- 'create', 'update', 'delete'
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  error_message TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo system_settings table cho WooCommerce config
CREATE TABLE IF NOT EXISTS system_settings (
  id BIGSERIAL PRIMARY KEY,
  category TEXT UNIQUE NOT NULL,
  config_data TEXT, -- encrypted JSON
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS cho tất cả tables với simple policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Simple policies cho authenticated users
CREATE POLICY IF NOT EXISTS "Authenticated users can access products" ON products
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Authenticated users can access product_updates" ON product_updates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Authenticated users can access system_settings" ON system_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- 5. Tạo indexes cho performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_product_updates_product_id ON product_updates(product_id);
CREATE INDEX IF NOT EXISTS idx_product_updates_created_at ON product_updates(created_at);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- 6. Grant permissions
GRANT ALL ON products TO authenticated;
GRANT ALL ON product_updates TO authenticated;
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON products TO service_role;
GRANT ALL ON product_updates TO service_role;
GRANT ALL ON system_settings TO service_role;

-- 7. Insert sample data để test
INSERT INTO product_updates (sku, name, change_type, status, created_at)
VALUES ('SAMPLE-001', 'Sample Product', 'create', 'completed', NOW())
ON CONFLICT DO NOTHING;

-- 8. Show results
SELECT 'All tables created successfully' as status;

SELECT 'Products table:' as info, COUNT(*)::text as count FROM products
UNION ALL
SELECT 'Product updates table:' as info, COUNT(*)::text as count FROM product_updates
UNION ALL
SELECT 'System settings table:' as info, COUNT(*)::text as count FROM system_settings
UNION ALL
SELECT 'Projects table:' as info, COUNT(*)::text as count FROM projects;