# 🔧 Hướng dẫn chạy fix cho Module quản lý thành viên

## ✅ Các vấn đề đã được fix

1. **Lỗi column `assigned_at` không tồn tại** - Function đã map `created_at` thành `assigned_at`
2. **Lỗi infinite recursion trong RLS** - Tạo function SECURITY DEFINER để bypass RLS
3. **Lỗi UUID = INTEGER** - Đã được fix trong code trước đó

## 📋 Các bước thực hiện

### Bước 1: Chạy migration SQL
```sql
-- Chạy file này trong Supabase SQL Editor:
f:\VSCODE\UpdateLocknLock\migrations\comprehensive_fix_all_member_issues.sql
```

File này sẽ:
- ✅ Fix function `get_project_members_for_user` với column mapping đúng
- ✅ Tạo function mới `get_available_users_for_project` để tránh RLS recursion
- ✅ Verify function `add_project_member`
- ✅ Grant permissions cho authenticated users

### Bước 2: Clear cache trình duyệt
```
Ctrl + Shift + Delete (hoặc Cmd + Shift + Delete trên Mac)
Chọn: Cached images and files
Hoặc dùng Ctrl + Shift + R để hard reload
```

### Bước 3: Test lại chức năng

1. **Login với tài khoản admin**
2. **Vào module Projects → Click "👥 Thành viên"**
3. **Kiểm tra console** - Không còn lỗi:
   - ❌ "column pm.assigned_at does not exist" → ✅ Đã fix
   - ❌ "infinite recursion detected" → ✅ Đã fix
   - ❌ "operator does not exist: uuid = integer" → ✅ Đã fix

4. **Test thêm thành viên:**
   - Click "➕ Thêm thành viên"
   - Dropdown hiển thị danh sách users (không còn lỗi)
   - Chọn user, chọn role, click "Thêm"
   - Member được thêm thành công

## 🔍 Các thay đổi kỹ thuật

### 1. Database Functions

#### `get_project_members_for_user(p_project_id INTEGER, p_user_id UUID)`
- Map `created_at` → `assigned_at` trong return value
- Qualify tất cả columns với table alias (pm.role, up.role)
- SECURITY DEFINER để bypass RLS

#### `get_available_users_for_project(p_project_id INTEGER, p_user_id UUID)`
- **MỚI** - Function SECURITY DEFINER để lấy available users
- Kiểm tra quyền: chỉ admin hoặc manager mới thấy
- Return users chưa là member của project
- Tránh infinite recursion của RLS

#### `add_project_member(...)`
- Verified signatures đúng
- SECURITY DEFINER để bypass RLS

### 2. Service Layer Changes

**File:** `src/services/projectMemberService.ts`

#### `getAvailableUsers(projectId)`
```typescript
// TRƯỚC (gây infinite recursion):
const { data } = await supabase
  .from('project_members')
  .select('user_id')
  .eq('project_id', projectId)  // ← RLS check lại project_members

// SAU (bypass RLS):
const { data } = await supabase.rpc('get_available_users_for_project', {
  p_project_id: projectId,
  p_user_id: user.id
})
```

## 🎯 Kết quả mong đợi

Sau khi chạy fix:
- ✅ Modal "Thành viên" load thành công
- ✅ Danh sách members hiển thị
- ✅ Dropdown "Chọn user" hiển thị available users
- ✅ Thêm member thành công
- ✅ Không còn error trong console

## 🐛 Nếu vẫn còn lỗi

1. **Kiểm tra functions đã tạo:**
```sql
SELECT
  proname as function_name,
  pg_get_function_identity_arguments(oid) as signature
FROM pg_proc
WHERE proname IN (
  'get_project_members_for_user',
  'get_available_users_for_project',
  'add_project_member'
)
ORDER BY proname;
```

2. **Kiểm tra columns trong project_members:**
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'project_members'
ORDER BY ordinal_position;
```

3. **Test function trực tiếp:**
```sql
-- Thay YOUR_PROJECT_ID và YOUR_USER_ID
SELECT * FROM get_available_users_for_project(463, '3114ecf0-6473-406d-b4e2-10150b4b09ba'::UUID);
```

## 📞 Báo lỗi

Nếu vẫn gặp vấn đề, cung cấp:
1. Screenshot console errors
2. Output của 3 câu query kiểm tra ở trên
3. Tài khoản đang test (admin/manager/viewer)
