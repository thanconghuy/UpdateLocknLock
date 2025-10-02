# 📝 TÓM TẮT THAY ĐỔI: ĐỒNG BỘ 4 CẤP ĐỘ PHÂN QUYỀN

> **Ngày cập nhật:** 2025-10-02
> **Mục đích:** Đồng bộ phân quyền giữa System Level và Project Level về 4 cấp độ giống nhau

---

## 🎯 MỤC TIÊU THAY ĐỔI

### Trước đây (Code cũ)
- ❌ System Roles: 4 cấp độ (admin, manager, editor, viewer)
- ❌ Project Roles: 5 cấp độ (admin, manager, **product_editor**, **project_viewer**, viewer)
- ❌ Không đồng bộ, gây khó hiểu và phức tạp trong code

### Sau khi thay đổi (Code mới)
- ✅ System Roles: 4 cấp độ (admin, manager, editor, viewer)
- ✅ Project Roles: 4 cấp độ (admin, manager, editor, viewer)
- ✅ Đồng bộ hoàn toàn, dễ hiểu và maintain

---

## 🔄 CHI TIẾT THAY ĐỔI

### 1. Thay đổi Project Roles

#### BEFORE (5 roles):
```typescript
'admin'          → Level 100
'manager'        → Level 80
'product_editor' → Level 60  // ❌ Xóa
'project_viewer' → Level 40  // ❌ Xóa
'viewer'         → Level 20  // ❌ Level 20 → 40
```

#### AFTER (4 roles):
```typescript
'admin'    → Level 100  // ✅ Mapping với System admin
'manager'  → Level 80   // ✅ Mapping với System manager
'editor'   → Level 60   // ✅ Mapping với System editor (thay product_editor)
'viewer'   → Level 40   // ✅ Mapping với System viewer (nâng từ 20 lên 40)
```

### 2. Mapping Logic

| System Role | Can Assign Project Roles | Default Project Role |
|-------------|-------------------------|---------------------|
| admin | admin, manager, editor, viewer | admin |
| manager | manager, editor, viewer | manager |
| editor | editor, viewer | editor |
| viewer | viewer | viewer |

**Nguyên tắc:**
- ✅ System role quyết định quyền tối đa trong project
- ✅ Có thể assign project role ≤ system role level
- ❌ Không thể assign project role > system role level
- ✅ Tên role giống nhau → Dễ hiểu, dễ maintain

---

## 📊 SO SÁNH PERMISSIONS

### Admin (Level 100)
```json
{
  "can_edit_project": true,
  "can_delete_project": true,
  "can_manage_members": true,
  "can_edit_products": true,
  "can_manage_woocommerce": true,
  "can_view_analytics": true
}
```

### Manager (Level 80)
```json
{
  "can_edit_project": true,
  "can_delete_project": false,        // ❌ Không xóa project
  "can_manage_members": true,
  "can_edit_products": true,
  "can_manage_woocommerce": true,
  "can_view_analytics": true
}
```

### Editor (Level 60) - Thay thế product_editor
```json
{
  "can_edit_project": false,
  "can_delete_project": false,
  "can_manage_members": false,
  "can_edit_products": true,          // ✅ Chỉnh sửa products
  "can_manage_woocommerce": true,     // ✅ Sync WooCommerce
  "can_view_analytics": true
}
```

### Viewer (Level 40) - Hợp nhất project_viewer
```json
{
  "can_edit_project": false,
  "can_delete_project": false,
  "can_manage_members": false,
  "can_edit_products": false,
  "can_manage_woocommerce": false,
  "can_view_analytics": true          // ✅ Xem analytics
}
```

---

## 🗂️ FILES ĐÃ TẠO/CẬP NHẬT

### 1. Database Migration
**File:** `migrations/20251002_create_4_project_roles.sql`
- ✅ Drop old project_roles table
- ✅ Create new với 4 roles
- ✅ Insert 4 roles với permissions đúng
- ✅ Enable RLS

### 2. TypeScript Types
**File:** `src/types/projectRoles.ts` (MỚI)
- ✅ `ProjectRoleName` type: 'admin' | 'manager' | 'editor' | 'viewer'
- ✅ `PROJECT_ROLE_LEVELS` constants
- ✅ `ProjectRole` interface
- ✅ `ProjectPermissions` interface
- ✅ `SYSTEM_TO_PROJECT_ROLE_MAPPING` mapping logic
- ✅ Helper functions: `canAssignRole()`, `getAssignableRoles()`, `getDefaultProjectRole()`

### 3. Documentation
**File:** `PROJECT_MEMBERS_ANALYSIS.md` (CẬP NHẬT)
- ✅ Section 2.3: Updated to 4 roles
- ✅ Section 5.1: Đồng bộ System và Project levels
- ✅ Thêm mapping table và nguyên tắc

---

## 🚀 CÁCH SỬ DỤNG

### 1. Chạy Migration
```sql
-- Chạy trong Supabase SQL Editor
\i migrations/20251002_create_4_project_roles.sql
```

### 2. Verify Roles
```sql
SELECT id, name, display_name, level
FROM project_roles
ORDER BY level DESC;

-- Expected output:
-- id | name    | display_name    | level
-- ---|---------|-----------------|------
-- 1  | admin   | Quản trị viên   | 100
-- 2  | manager | Người quản lý   | 80
-- 3  | editor  | Biên tập viên   | 60
-- 4  | viewer  | Người xem       | 40
```

### 3. Sử dụng trong Code

#### Import types:
```typescript
import {
  ProjectRoleName,
  ProjectRole,
  ProjectPermissions,
  canAssignRole,
  getAssignableRoles,
  getDefaultProjectRole
} from '@/types/projectRoles'
```

#### Check if can assign role:
```typescript
const userSystemRole = 'manager' // User's system role
const targetProjectRole = 'admin' // Role to assign

if (canAssignRole(userSystemRole, targetProjectRole)) {
  // OK: Manager có thể assign manager/editor/viewer
  // ❌ Error: Manager không thể assign admin
} else {
  throw new Error('Cannot assign role higher than your level')
}
```

#### Get assignable roles for dropdown:
```typescript
const userSystemRole = 'editor'
const assignableRoles = getAssignableRoles(userSystemRole)
// Returns: ['editor', 'viewer']

// Render dropdown:
assignableRoles.map(role => (
  <option value={role}>{role}</option>
))
```

#### Get default project role:
```typescript
const userSystemRole = 'manager'
const defaultRole = getDefaultProjectRole(userSystemRole)
// Returns: 'manager'
```

---

## ⚠️ BREAKING CHANGES

### 1. Database
- ❌ **Xóa roles:** `product_editor`, `project_viewer`
- ✅ **Thêm role mới:** `editor` (thay product_editor)
- ⚠️ **Lưu ý:** Nếu có data cũ với `product_editor` hoặc `project_viewer`, cần migrate:

```sql
-- Migrate old roles to new roles
UPDATE project_members
SET role = 'editor'
WHERE role = 'product_editor';

UPDATE project_members
SET role = 'viewer'
WHERE role IN ('project_viewer', 'viewer');
```

### 2. TypeScript Code
- ❌ **Old type:**
  ```typescript
  role: 'admin' | 'manager' | 'product_editor' | 'project_viewer' | 'viewer'
  ```
- ✅ **New type:**
  ```typescript
  role: 'admin' | 'manager' | 'editor' | 'viewer'
  ```

### 3. Frontend Components
Cập nhật tất cả components sử dụng project roles:
- ✅ Import `ProjectRoleName` từ `@/types/projectRoles`
- ✅ Thay `product_editor` → `editor`
- ✅ Thay `project_viewer` → `viewer`
- ✅ Update dropdowns và conditional rendering

---

## ✅ CHECKLIST MIGRATION

### Pre-migration
- [ ] Backup database
- [ ] Backup code (git commit)
- [ ] Review tài liệu này

### Migration Steps
- [ ] Chạy migration `20251002_create_4_project_roles.sql`
- [ ] Verify 4 roles được tạo đúng
- [ ] Migrate old data (nếu có):
  ```sql
  UPDATE project_members SET role = 'editor' WHERE role = 'product_editor';
  UPDATE project_members SET role = 'viewer' WHERE role IN ('project_viewer', 'viewer');
  ```
- [ ] Check không còn old roles trong database:
  ```sql
  SELECT DISTINCT role FROM project_members;
  -- Should only return: admin, manager, editor, viewer
  ```

### Code Updates
- [ ] Update TypeScript interfaces
- [ ] Update components sử dụng roles
- [ ] Update service layer
- [ ] Update permission checks
- [ ] Run TypeScript compile: `npm run build`
- [ ] Fix any type errors

### Testing
- [ ] Test với mỗi role (admin, manager, editor, viewer)
- [ ] Test assign roles (check mapping logic)
- [ ] Test permissions cho mỗi role
- [ ] Test UI rendering đúng

### Post-migration
- [ ] Monitor production logs
- [ ] Gather user feedback
- [ ] Update documentation

---

## 📚 TÀI LIỆU LIÊN QUAN

1. [PROJECT_MEMBERS_ANALYSIS.md](PROJECT_MEMBERS_ANALYSIS.md) - Phân tích toàn diện hệ thống
2. [migrations/20251002_create_4_project_roles.sql](migrations/20251002_create_4_project_roles.sql) - Migration script
3. [src/types/projectRoles.ts](src/types/projectRoles.ts) - TypeScript types và helpers

---

## 🔍 EXAMPLES

### Example 1: Admin assigns roles
```typescript
// Admin có thể assign bất kỳ role nào
const adminSystemRole = 'admin'
canAssignRole(adminSystemRole, 'admin')    // ✅ true
canAssignRole(adminSystemRole, 'manager')  // ✅ true
canAssignRole(adminSystemRole, 'editor')   // ✅ true
canAssignRole(adminSystemRole, 'viewer')   // ✅ true
```

### Example 2: Manager assigns roles
```typescript
// Manager chỉ assign được manager trở xuống
const managerSystemRole = 'manager'
canAssignRole(managerSystemRole, 'admin')    // ❌ false
canAssignRole(managerSystemRole, 'manager')  // ✅ true
canAssignRole(managerSystemRole, 'editor')   // ✅ true
canAssignRole(managerSystemRole, 'viewer')   // ✅ true
```

### Example 3: Editor assigns roles
```typescript
// Editor chỉ assign được editor hoặc viewer
const editorSystemRole = 'editor'
canAssignRole(editorSystemRole, 'admin')    // ❌ false
canAssignRole(editorSystemRole, 'manager')  // ❌ false
canAssignRole(editorSystemRole, 'editor')   // ✅ true
canAssignRole(editorSystemRole, 'viewer')   // ✅ true
```

### Example 4: Viewer assigns roles
```typescript
// Viewer chỉ assign được viewer
const viewerSystemRole = 'viewer'
canAssignRole(viewerSystemRole, 'admin')    // ❌ false
canAssignRole(viewerSystemRole, 'manager')  // ❌ false
canAssignRole(viewerSystemRole, 'editor')   // ❌ false
canAssignRole(viewerSystemRole, 'viewer')   // ✅ true
```

---

## 💡 LỢI ÍCH CỦA VIỆC ĐỒNG BỘ

### 1. Đơn giản hóa Code
- ✅ Cùng tên role → Dễ map, dễ hiểu
- ✅ Giảm confusion giữa system và project roles
- ✅ Code ngắn gọn, maintainable hơn

### 2. Dễ Scale
- ✅ Thêm role mới: Thêm ở cả 2 nơi với cùng tên
- ✅ Sửa permissions: Sửa ở 1 nơi, apply cho cả 2
- ✅ Clear separation of concerns

### 3. Better UX
- ✅ User dễ hiểu: "Bạn là manager ở hệ thống → manager trong project"
- ✅ Ít lỗi hơn: Không thể assign sai role
- ✅ Predictable behavior

### 4. Type Safety
- ✅ TypeScript compile-time checking
- ✅ Auto-complete trong IDE
- ✅ Catch errors sớm

---

**🎉 Hoàn thành đồng bộ 4 cấp độ phân quyền!**
