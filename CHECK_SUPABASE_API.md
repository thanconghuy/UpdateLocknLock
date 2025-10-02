# 🔍 KIỂM TRA SUPABASE API

## Vấn đề hiện tại

Functions **tồn tại trong database** ✅ nhưng API trả về **404 Not Found** ❌

Điều này có nghĩa là **PostgREST** (REST API layer) chưa nhận biết functions.

---

## 🧪 Test API trực tiếp

### Bước 1: Lấy thông tin Supabase Project

Trong code, tìm file: `src/lib/supabase.ts` hoặc `src/config/env.ts`

Lấy:
- `SUPABASE_URL` (ví dụ: `https://eweqqjnyinmxprwrizgv.supabase.co`)
- `SUPABASE_ANON_KEY`

### Bước 2: Test API bằng curl

Mở terminal và chạy:

```bash
curl -X POST 'https://YOUR_PROJECT_ID.supabase.co/rest/v1/rpc/get_user_project_role' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "p_project_id": 463,
    "p_user_id": "3114ecf0-6473-406d-b4e2-10150b4b09ba"
  }'
```

**Kết quả mong đợi:**
- ✅ Status 200 + data → API OK, browser cache issue
- ❌ Status 404 → PostgREST chưa reload schema

---

## 🔧 GIẢI PHÁP

### Option 1: Restart PostgREST (Chỉ cho local/self-hosted)

Nếu bạn dùng Supabase local:
```bash
supabase stop
supabase start
```

### Option 2: Trigger Schema Reload (Supabase Cloud)

**Cách 1 - Chạy SQL này:**
```sql
-- File: force_grant_permissions.sql
-- Chạy trong Supabase SQL Editor
```

**Cách 2 - Via Supabase Dashboard:**
1. Vào **Supabase Dashboard**
2. Settings → API
3. Click **"Reload Schema"** (nếu có button này)

**Cách 3 - Đợi tự động refresh:**
- PostgREST cache thường expire sau **5-10 phút**
- Đợi 10 phút, rồi test lại

### Option 3: Sử dụng Supabase Studio

1. Vào **Supabase Dashboard**
2. **Database** → **Functions**
3. Kiểm tra xem functions có hiển thị không?
4. Nếu **KHÔNG thấy** → Functions chưa được expose qua API
5. Nếu **THẤY** → Click vào function → Check "Exposed via API"

---

## 🎯 WORKAROUND: Tạo lại functions với ALTER

Đôi khi PostgREST chỉ nhận biết khi có **ALTER** event.

Chạy script này:

```sql
-- Alter each function (force schema change detection)
ALTER FUNCTION get_user_project_role(INTEGER, UUID) SECURITY DEFINER;
ALTER FUNCTION get_user_project_permissions(INTEGER, UUID) SECURITY DEFINER;
ALTER FUNCTION can_user_manage_members(INTEGER, UUID) SECURITY DEFINER;
ALTER FUNCTION get_project_members_for_user(INTEGER, UUID) SECURITY DEFINER;
ALTER FUNCTION get_available_users_for_project(INTEGER, UUID) SECURITY DEFINER;
ALTER FUNCTION add_project_member(INTEGER, UUID, VARCHAR, UUID, JSONB) SECURITY DEFINER;

-- Trigger comment change
COMMENT ON FUNCTION get_user_project_role(INTEGER, UUID) IS 'Get user role in project - V3';
COMMENT ON FUNCTION get_user_project_permissions(INTEGER, UUID) IS 'Get user permissions in project - V3';
COMMENT ON FUNCTION can_user_manage_members(INTEGER, UUID) IS 'Check if user can manage members - V3';

SELECT '✅ Functions altered - PostgREST should detect changes now';
SELECT 'Wait 30 seconds, then test API again';
```

---

## 📊 Diagnostic Steps

### 1. Verify functions exist in DB:
```sql
SELECT proname, pg_get_function_identity_arguments(oid)
FROM pg_proc
WHERE proname = 'get_user_project_role';
```
**Result:** Should return 1 row ✅ (bạn đã verify - OK!)

### 2. Verify permissions:
```sql
SELECT has_function_privilege('authenticated', 'get_user_project_role(integer,uuid)', 'EXECUTE');
```
**Expected:** `true` ✅

### 3. Check PostgREST config:
```sql
SHOW pgrst.db_schemas;
```
**Expected:** Should include `public` schema

### 4. Verify function is SECURITY DEFINER:
```sql
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'get_user_project_role';
```
**Expected:** `prosecdef = true` ✅

---

## 🆘 Nếu tất cả đều OK nhưng vẫn 404

**Nguyên nhân:** PostgREST schema cache chưa refresh

**Giải pháp cuối cùng:**

### Sử dụng Supabase Support

1. Vào **Supabase Dashboard**
2. Click **Support** (góc dưới bên phải)
3. Yêu cầu: "Please reload PostgREST schema cache for my project"
4. Họ sẽ restart API server cho bạn

**Hoặc**

### Tạo một function test đơn giản

```sql
CREATE OR REPLACE FUNCTION test_api_works()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'API is working!'::TEXT;
$$;

GRANT EXECUTE ON FUNCTION test_api_works() TO authenticated;
```

Nếu function này cũng 404 → Chắc chắn là PostgREST cache issue.

---

## 💡 TIP: Tránh issue này trong tương lai

Khi tạo functions mới trong Supabase Cloud:

1. **Tạo via Supabase Dashboard** (Database → Functions) thay vì SQL Editor
   - Dashboard tự động trigger schema reload

2. **Hoặc** sau khi chạy SQL:
   - Đợi 5-10 phút trước khi test
   - Hoặc trigger change bằng ALTER command

3. **Local development:**
   - Dùng `supabase` CLI để restart PostgREST ngay lập tức

---

**TL;DR:** Chạy `force_grant_permissions.sql` → Đợi 1 phút → Test lại. Nếu vẫn lỗi → Đợi 10 phút hoặc contact Supabase support.
