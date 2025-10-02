# 🚨 FIX LỖI 404 - Functions tồn tại nhưng API trả về 404

## 📊 Tình huống

✅ Functions **ĐÃ TỒN TẠI** trong database (bạn đã verify)
❌ API vẫn trả về **404 Not Found**

```
POST .../rpc/get_user_project_role 404 (Not Found)
```

## 🔍 Nguyên nhân

**PostgREST schema cache** chưa refresh. Supabase sử dụng PostgREST để expose database functions qua REST API. PostgREST cache schema để tăng performance, nên khi bạn tạo functions mới, nó không nhận biết ngay lập tức.

---

## 🔧 GIẢI PHÁP - Làm theo thứ tự

### ✅ Bước 1: Trigger PostgREST Refresh

**Chạy file này trong Supabase SQL Editor:**
```
f:\VSCODE\UpdateLocknLock\migrations\trigger_postgrest_refresh.sql
```

File này sẽ:
1. Add comments to functions (trigger change detection)
2. Revoke và re-grant permissions (trigger another event)
3. Verify permissions

**Kết quả mong đợi:**
```
✅ PostgREST schema refresh triggered
⏳ Wait 30-60 seconds for changes to propagate
```

### ⏳ Bước 2: Đợi 1-2 phút

PostgREST cần thời gian để:
- Detect schema changes
- Reload function definitions
- Update API endpoints

**Đợi từ 30 giây đến 2 phút.**

### 🔄 Bước 3: Hard Refresh Browser

```
1. Ctrl + Shift + R (hard reload)
2. Hoặc đóng browser hoàn toàn → Mở lại
3. Clear cache: Ctrl + Shift + Delete
```

### 🧪 Bước 4: Test Lại

1. Login vào ứng dụng
2. Kiểm tra console - **KHÔNG còn lỗi 404**
3. Navigate to Projects → "👥 Thành viên"
4. Modal mở thành công ✅

---

## 🆘 Nếu vẫn lỗi 404 sau 5 phút

### Option A: Verify Permissions

Chạy query này:

```sql
SELECT
  proname,
  has_function_privilege('authenticated', oid, 'EXECUTE') as can_execute
FROM pg_proc
WHERE proname IN (
  'get_user_project_role',
  'get_user_project_permissions',
  'can_user_manage_members'
);
```

**Kết quả mong đợi:** Tất cả `can_execute = true`

Nếu **FALSE** → Chạy lại `trigger_postgrest_refresh.sql`

### Option B: Test API trực tiếp

Mở browser DevTools → Console, paste code này:

```javascript
// Get your Supabase URL and anon key from src/lib/supabase.ts
const SUPABASE_URL = 'https://eweqqjnyinmxprwrizgv.supabase.co'
const ANON_KEY = 'your_anon_key_here'

fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_project_role`, {
  method: 'POST',
  headers: {
    'apikey': ANON_KEY,
    'Authorization': `Bearer ${ANON_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    p_project_id: 463,
    p_user_id: '3114ecf0-6473-406d-b4e2-10150b4b09ba'
  })
})
.then(r => r.json())
.then(data => console.log('✅ API Response:', data))
.catch(err => console.error('❌ API Error:', err))
```

**Kết quả:**
- ✅ Data returned → API OK, browser issue → Clear cache
- ❌ 404 → PostgREST vẫn chưa refresh → Đợi thêm 5-10 phút

### Option C: Đợi Auto-Refresh

PostgREST schema cache tự động expire sau **5-10 phút** (tùy config).

**Đơn giản:** Đợi 10 phút, rồi test lại. Không cần làm gì cả.

---

## 🎯 Giải pháp CUỐI CÙNG (nếu tất cả đều fail)

### Tạo function mới với tên khác

PostgREST có thể cache theo function name. Thử tạo alias:

```sql
-- Tạo function mới với tên khác (alias)
CREATE OR REPLACE FUNCTION get_user_role_v2(
  p_project_id INTEGER,
  p_user_id UUID
) RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Gọi function gốc
  RETURN get_user_project_role(p_project_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_role_v2(INTEGER, UUID) TO authenticated;
```

Rồi update code để gọi `get_user_role_v2` thay vì `get_user_project_role`.

**NHƯNG** đây là workaround không tốt. Nên dùng khi thực sự desperate.

---

## 💡 Tại sao lại xảy ra?

### PostgREST Schema Cache

PostgREST (component expose PostgreSQL qua REST API) cache:
1. **Function definitions** - Tên, parameters, return types
2. **Permissions** - Roles nào có quyền execute
3. **Schema structure** - Tables, views, functions

**Cache này refresh khi:**
- ✅ Server restart
- ✅ SIGHUP signal (không dùng được trên Supabase Cloud)
- ✅ Schema change events (ALTER, COMMENT, GRANT/REVOKE)
- ✅ Auto-expire (5-10 phút)

**Supabase Cloud:** Bạn không control server, nên chỉ có thể:
1. Trigger schema change events (ALTER, COMMENT, GRANT/REVOKE)
2. Đợi auto-expire

---

## ✅ Checklist Troubleshooting

- [ ] Chạy `trigger_postgrest_refresh.sql`
- [ ] Đợi 1-2 phút
- [ ] Hard refresh browser (Ctrl+Shift+R)
- [ ] Test lại - kiểm tra console
- [ ] Nếu vẫn lỗi → Đợi thêm 5 phút
- [ ] Verify permissions với SQL query
- [ ] Test API trực tiếp với fetch()
- [ ] Nếu vẫn lỗi → Đợi 10 phút (auto-expire)
- [ ] Cuối cùng → Contact Supabase support

---

## 📞 Contact Supabase Support

Nếu sau **15 phút** vẫn lỗi:

1. Vào [Supabase Dashboard](https://supabase.com/dashboard)
2. Settings → Support
3. Message:
```
Hi, I created new PostgreSQL functions but PostgREST API returns 404.
Functions exist in database (verified with pg_proc query).
Please reload PostgREST schema cache for my project.

Project ID: [your_project_id]
Functions: get_user_project_role, get_user_project_permissions, can_user_manage_members
```

4. Họ sẽ restart PostgREST cho bạn trong vài phút.

---

**TL;DR:**
1. Chạy `trigger_postgrest_refresh.sql`
2. Đợi 2 phút
3. Hard refresh browser
4. Test → Nếu vẫn lỗi → Đợi 10 phút
5. Nếu vẫn lỗi → Contact support
