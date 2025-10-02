# 📊 PHASE 2: DATABASE SCHEMA - HƯỚNG DẪN

> **File migration:** `migrations/phase2_create_clean_schema.sql`
> **Thời gian ước tính:** ~5-10 phút

---

## 🎯 MỤC TIÊU PHASE 2

Tạo clean database schema mới với:
- ✅ 4 project roles đồng bộ (admin, manager, editor, viewer)
- ✅ project_members table với schema rõ ràng
- ✅ 5 SECURITY DEFINER functions
- ✅ Simple RLS policies

---

## 📋 CÁC BƯỚC THỰC HIỆN

### Bước 1: Chạy Migration

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy toàn bộ nội dung file: `migrations/phase2_create_clean_schema.sql`
3. Paste vào SQL Editor
4. Click **"Run"**

### Bước 2: Kiểm tra Output

Output mong đợi:

```
✅ Step 1: Created project_roles table with 4 roles
✅ Step 2: Created project_members table with indexes and RLS
✅ Step 3.1: Created get_project_members function
✅ Step 3.2: Created get_available_users_for_project function
✅ Step 3.3: Created add_project_member function
✅ Step 3.4: Created update_project_member_role function
✅ Step 3.5: Created remove_project_member function

=== VERIFICATION ===
project_roles table:
id | name    | display_name    | level
1  | admin   | Quản trị viên   | 100
2  | manager | Người quản lý   | 80
3  | editor  | Biên tập viên   | 60
4  | viewer  | Người xem       | 40

✅ PHASE 2 COMPLETED SUCCESSFULLY!
```

---

## 🔍 CHI TIẾT SCHEMA

### 1. Table: project_roles

```sql
CREATE TABLE project_roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,      -- admin|manager|editor|viewer
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL,                 -- 100|80|60|40
  default_permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**4 Roles:**
| Name | Level | Permissions |
|------|-------|-------------|
| admin | 100 | Full quyền |
| manager | 80 | Quản lý members & products, không xóa project |
| editor | 60 | Chỉnh sửa products, sync WooCommerce |
| viewer | 40 | Chỉ xem |

### 2. Table: project_members

```sql
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL REFERENCES projects(project_id),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  role VARCHAR(50) NOT NULL REFERENCES project_roles(name),
  status VARCHAR(20) DEFAULT 'active',
  permissions JSONB DEFAULT '{}',
  notes TEXT,
  invited_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);
```

**Indexes:**
- `idx_pm_project` - Tìm members theo project
- `idx_pm_user` - Tìm projects của user
- `idx_pm_status` - Filter theo status
- `idx_pm_role` - Filter theo role
- `idx_pm_composite` - Query tổng hợp

### 3. Functions (SECURITY DEFINER)

#### Function 1: `get_project_members(project_id, user_id)`
- **Mục đích:** Lấy danh sách members của project
- **Permission:** Admin, Owner, hoặc Member của project
- **Return:** Table với member info + user profile

#### Function 2: `get_available_users_for_project(project_id, user_id)`
- **Mục đích:** Lấy users có thể thêm vào project
- **Permission:** Admin, Owner, hoặc Manager/Admin của project (level >= 80)
- **Return:** Users chưa là member

#### Function 3: `add_project_member(project_id, user_id, role, requesting_user_id, custom_permissions)`
- **Mục đích:** Thêm member mới
- **Business Rules:**
  - Không thể assign role cao hơn role của mình
  - User chưa là member
- **Return:** UUID của member mới

#### Function 4: `update_project_member_role(member_id, new_role, requesting_user_id, custom_permissions)`
- **Mục đích:** Update role của member
- **Business Rules:**
  - Không thể update role của chính mình
  - Không thể assign role cao hơn role của mình
- **Return:** BOOLEAN

#### Function 5: `remove_project_member(member_id, requesting_user_id)`
- **Mục đích:** Xóa member khỏi project
- **Business Rules:**
  - Không thể xóa chính mình
  - Phải có ít nhất 1 admin
- **Return:** BOOLEAN

### 4. RLS Policies

**Simple approach:**
- Direct access: Chỉ System Admin
- Other users: Phải dùng SECURITY DEFINER functions

```sql
CREATE POLICY "system_admins_full_access"
ON project_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
```

---

## 🧪 TEST FUNCTIONS

### Test 1: Get Roles
```sql
SELECT * FROM project_roles ORDER BY level DESC;

-- Expected: 4 rows (admin, manager, editor, viewer)
```

### Test 2: Get Members (giả sử project_id = 463)
```sql
SELECT * FROM get_project_members(
  463,
  'YOUR_USER_ID'::UUID
);

-- Expected: Empty table (chưa có members) hoặc permission error nếu không có quyền
```

### Test 3: Get Available Users
```sql
SELECT * FROM get_available_users_for_project(
  463,
  'YOUR_USER_ID'::UUID
);

-- Expected: Danh sách users có thể thêm vào project
```

### Test 4: Add Member (Admin thêm manager)
```sql
SELECT add_project_member(
  463,                          -- project_id
  'TARGET_USER_ID'::UUID,       -- user_id
  'manager',                    -- role
  'YOUR_ADMIN_USER_ID'::UUID,   -- requesting_user_id
  NULL                          -- custom_permissions
);

-- Expected: UUID của member mới
```

### Test 5: Update Role
```sql
SELECT update_project_member_role(
  'MEMBER_ID'::UUID,            -- member_id
  'editor',                     -- new_role
  'YOUR_ADMIN_USER_ID'::UUID,   -- requesting_user_id
  NULL                          -- custom_permissions
);

-- Expected: true
```

### Test 6: Remove Member
```sql
SELECT remove_project_member(
  'MEMBER_ID'::UUID,            -- member_id
  'YOUR_ADMIN_USER_ID'::UUID    -- requesting_user_id
);

-- Expected: true
```

---

## ⚠️ TROUBLESHOOTING

### Lỗi 1: "relation projects does not exist"
**Nguyên nhân:** projects table chưa có column project_id (INTEGER)

**Fix:** Check schema projects table:
```sql
\d projects
```

### Lỗi 2: "relation user_profiles does not exist"
**Nguyên nhân:** user_profiles table chưa tạo

**Fix:** Tạo user_profiles trước

### Lỗi 3: Permission denied khi test functions
**Nguyên nhân:** Chưa grant execute permissions

**Fix:**
```sql
GRANT EXECUTE ON FUNCTION get_project_members TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_users_for_project TO authenticated;
GRANT EXECUTE ON FUNCTION add_project_member TO authenticated;
GRANT EXECUTE ON FUNCTION update_project_member_role TO authenticated;
GRANT EXECUTE ON FUNCTION remove_project_member TO authenticated;
```

### Lỗi 4: "Cannot assign role higher than your own"
**Nguyên nhân:** Manager cố assign role admin

**Expected behavior:** Đúng! Manager không thể assign admin

---

## ✅ VERIFICATION CHECKLIST

Sau khi chạy migration, verify:

### Tables
- [ ] `project_roles` table tạo thành công
- [ ] `project_members` table tạo thành công
- [ ] 4 roles được insert (admin, manager, editor, viewer)
- [ ] Indexes được tạo (5 indexes)

### Functions
- [ ] `get_project_members` tồn tại
- [ ] `get_available_users_for_project` tồn tại
- [ ] `add_project_member` tồn tại
- [ ] `update_project_member_role` tồn tại
- [ ] `remove_project_member` tồn tại

### RLS Policies
- [ ] RLS enabled trên `project_roles`
- [ ] RLS enabled trên `project_members`
- [ ] Policies được tạo

### Permissions
- [ ] Authenticated users có thể execute functions
- [ ] Test function call thành công

---

## 📊 KIỂM TRA NHANH

```sql
-- 1. Check roles
SELECT COUNT(*) FROM project_roles;
-- Expected: 4

-- 2. Check functions
SELECT COUNT(*) FROM pg_proc
WHERE proname IN (
  'get_project_members',
  'get_available_users_for_project',
  'add_project_member',
  'update_project_member_role',
  'remove_project_member'
);
-- Expected: 5

-- 3. Check RLS enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('project_roles', 'project_members');
-- Expected: 2 rows, rowsecurity = true

-- 4. Check policies
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename IN ('project_roles', 'project_members');
-- Expected: 2 policies
```

---

## 🎉 KẾT QUẢ MONG ĐỢI

Sau khi hoàn thành Phase 2:

### ✅ Database:
- 4 project roles
- project_members table với proper schema
- 5 SECURITY DEFINER functions hoạt động
- RLS policies đơn giản, không infinite recursion

### ✅ Tình trạng:
- Database schema clean và consistent
- Functions có business logic đầy đủ
- Không có bugs của code cũ
- Sẵn sàng cho Phase 3 (Service Layer)

### 🔄 Next Steps:
- **Phase 3:** Implement Service Layer (TypeScript class)
- **Phase 4:** Create UI Components
- **Phase 5:** Testing & Refinement

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề:
1. Check error message trong Supabase SQL Editor
2. Verify tables tồn tại: `\dt`
3. Verify functions: `\df`
4. Check logs trong Supabase Dashboard

---

**✅ Sau khi verify thành công, báo để tiếp tục Phase 3!**
