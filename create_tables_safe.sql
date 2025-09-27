-- Tạo tables một cách an toàn (Safe version)

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

-- 2. Tạo product_updates table
CREATE TABLE IF NOT EXISTS product_updates (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT,
  sku TEXT,
  name TEXT,
  old_price DECIMAL(10,2),
  new_price DECIMAL(10,2),
  old_stock INTEGER,
  new_stock INTEGER,
  change_type TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id BIGSERIAL PRIMARY KEY,
  category TEXT UNIQUE NOT NULL,
  config_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies (ignore errors if not exist)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can access products" ON products;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can access product_updates" ON product_updates;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can access system_settings" ON system_settings;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 6. Create new policies
CREATE POLICY "Authenticated users can access products" ON products
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access product_updates" ON product_updates
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can access system_settings" ON system_settings
  FOR ALL USING (auth.role() = 'authenticated');

-- 7. Grant permissions
GRANT ALL ON products TO authenticated;
GRANT ALL ON product_updates TO authenticated;
GRANT ALL ON system_settings TO authenticated;
GRANT ALL ON products TO service_role;
GRANT ALL ON product_updates TO service_role;
GRANT ALL ON system_settings TO service_role;

-- 8. Insert test data safely
DO $$
BEGIN
    INSERT INTO product_updates (sku, name, change_type, status)
    VALUES ('SAMPLE-001', 'Sample Product', 'create', 'completed');
EXCEPTION
    WHEN unique_violation THEN NULL;
    WHEN OTHERS THEN NULL;
END $$;

-- 9. Show results
SELECT 'Tables setup completed successfully' as status;

-- Check table existence
SELECT
    table_name,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t.table_name)
         THEN 'EXISTS'
         ELSE 'MISSING'
    END as status
FROM (
    VALUES
    ('products'),
    ('product_updates'),
    ('system_settings'),
    ('projects'),
    ('user_profiles')
) AS t(table_name);