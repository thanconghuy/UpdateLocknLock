# 📊 Tổng kết Module Quản lý Thành viên Project

## 🎯 Mục tiêu

Xây dựng module quản lý thành viên cho từng project với các tính năng:
- ✅ Xem danh sách thành viên
- ✅ Thêm thành viên từ danh sách users có sẵn
- ✅ Cập nhật role của thành viên
- ✅ Xóa thành viên khỏi project
- ✅ Phân quyền dựa trên role (admin, manager, product_editor, project_viewer, viewer)

## 📦 Các thành phần đã tạo

### 1. Database Schema

#### Table: `project_roles` (Đã tồn tại)
```sql
- id: SERIAL PRIMARY KEY
- name: VARCHAR (admin, manager, product_editor, project_viewer, viewer)
- display_name: VARCHAR
- description: TEXT
- level: INTEGER (100=admin, 80=manager, 60=editor, 40=project_viewer, 20=viewer)
- default_permissions: JSONB
- is_active: BOOLEAN
```

#### Table: `project_members` (Mới tạo)
```sql
- id: UUID PRIMARY KEY
- project_id: INTEGER → references projects(project_id)
- user_id: UUID → references user_profiles(id)
- role: VARCHAR → references project_roles(name)
- status: VARCHAR (active/removed/pending)
- invited_by: UUID
- permissions: JSONB (override default_permissions)
- notes: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### 2. Database Functions (SECURITY DEFINER)

#### `get_project_members_for_user(p_project_id INTEGER, p_user_id UUID)`
**Mục đích:** Lấy danh sách members với kiểm tra quyền
**Logic:**
- Admin: Xem tất cả members
- Non-admin: Chỉ xem members nếu họ cũng là member

**Return:** Table với thông tin member + user profile

#### `get_available_users_for_project(p_project_id INTEGER, p_user_id UUID)`
**Mục đích:** Lấy danh sách users có thể thêm vào project
**Logic:**
- Kiểm tra quyền: admin hoặc manager
- Return users chưa là member

**Return:** Table với id, email, full_name, role

#### `add_project_member(p_project_id, p_user_id, p_role, p_invited_by, p_permissions)`
**Mục đích:** Thêm member mới
**Logic:**
- Kiểm tra quyền của người thêm (via can_user_manage_members)
- Kiểm tra user đã là member chưa
- Insert vào project_members

**Return:** UUID của member mới

#### `can_user_manage_members(p_project_id INTEGER, p_user_id UUID)`
**Mục đích:** Kiểm tra user có quyền quản lý members không
**Logic:**
- Admin: Có quyền với mọi project
- Non-admin: Cần có role level ≥ 80 (manager+) trong project đó

**Return:** BOOLEAN

#### `get_user_project_role(p_project_id INTEGER, p_user_id UUID)`
**Mục đích:** Lấy role của user trong project
**Return:** VARCHAR (role name hoặc 'none')

#### `get_user_project_permissions(p_project_id INTEGER, p_user_id UUID)`
**Mục đích:** Lấy permissions của user trong project
**Logic:**
- Admin system role → Full permissions
- Project member → Permissions từ role + custom overrides
- Không phải member → No permissions

**Return:** JSONB với can_edit_project, can_manage_members, etc.

### 3. Row Level Security (RLS)

**Chiến lược:** Simplified RLS + SECURITY DEFINER functions

```sql
-- RLS policies chỉ cho phép admin truy cập trực tiếp
CREATE POLICY "Admins can view all members"
ON project_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Non-admins dùng SECURITY DEFINER functions
-- → Tránh infinite recursion
```

### 4. Frontend Components

#### `ProjectManagement.tsx`
**Chức năng:** Danh sách projects với button "👥 Thành viên"
**Key Changes:**
- Pass `project.project_id` (INTEGER) thay vì `project.id` (UUID)
- Open modal `ProjectMemberManagement` khi click

#### `ProjectMemberManagement.tsx`
**Chức năng:** Modal quản lý members của 1 project
**Features:**
- Hiển thị danh sách members hiện tại
- Form thêm member mới (dropdown chọn user)
- Cập nhật role
- Xóa member

**Props:**
```typescript
interface ProjectMemberManagementProps {
  projectId: number  // INTEGER, not UUID!
  projectName: string
  onClose: () => void
}
```

### 5. Service Layer

#### `ProjectMemberService.ts`
**Methods:**
- `getProjectMembers(projectId)` - RPC to get_project_members_for_user
- `getAvailableUsers(projectId)` - RPC to get_available_users_for_project
- `addProjectMember(projectId, userId, role, permissions)` - RPC to add_project_member
- `updateMemberRole(memberId, role, permissions)` - Direct update
- `removeMember(memberId)` - Set status='removed'
- `getUserProjectRole(projectId, userId)` - RPC to get_user_project_role
- `getUserProjectPermissions(projectId, userId)` - RPC to get_user_project_permissions
- `getAvailableRoles()` - Query project_roles table

**Key Change:** Tất cả đều dùng RPC calls thay vì direct queries để tránh RLS issues

## 🐛 Các lỗi đã fix

### 1. Column Name Mismatch
**Lỗi:** `column pm.assigned_at does not exist`
**Nguyên nhân:** Table có column `created_at` nhưng function reference `assigned_at`
**Fix:** Map `created_at as assigned_at` trong SELECT của function

### 2. Infinite Recursion
**Lỗi:** `infinite recursion detected in policy for relation "project_members"`
**Nguyên nhân:** RLS policy check project_members để grant access vào chính project_members
**Fix:**
- RLS policy chỉ cho admin
- Non-admin dùng SECURITY DEFINER functions (bypass RLS)

### 3. UUID vs INTEGER Type Mismatch
**Lỗi:** `operator does not exist: uuid = integer`
**Nguyên nhân:** Pass `project.id` (UUID) thay vì `project.project_id` (INTEGER)
**Fix:**
- ProjectManagement.tsx:446 → `project.project_id`
- ProjectContext.tsx:493-494 → `currentProject.project_id`

### 4. Ambiguous Column Reference
**Lỗi:** `column reference "role" is ambiguous`
**Nguyên nhân:** Both `project_members` và `user_profiles` có column `role`
**Fix:** Qualify tất cả: `pm.role::VARCHAR`, `up.role::VARCHAR`

### 5. Function Signature Conflicts
**Lỗi:** `Could not choose the best candidate function`
**Nguyên nhân:** Multiple migrations tạo duplicate functions
**Fix:** Drop all variations, recreate with explicit signatures

### 6. Component Hierarchy
**Lỗi:** ProjectProvider không load, stuck on "Loading Projects..."
**Nguyên nhân:** ProjectProvider inside ProtectedRoute (circular dependency)
**Fix:** Move ProjectProvider outside ProtectedRoute trong App.tsx

## 🔄 Flow hoạt động

### Add Member Flow
```
1. User clicks "👥 Thành viên" button
   ↓
2. ProjectMemberManagement modal opens
   ↓
3. Modal calls ProjectMemberService.getAvailableUsers(projectId)
   ↓
4. Service → RPC call → get_available_users_for_project(projectId, currentUserId)
   ↓
5. Function checks permissions (admin or manager)
   ↓
6. Function returns users NOT in project_members
   ↓
7. Dropdown populated with available users
   ↓
8. User selects user + role → Click "Thêm"
   ↓
9. Service → RPC call → add_project_member(projectId, userId, role, invitedBy, permissions)
   ↓
10. Function checks can_user_manage_members
    ↓
11. Function inserts into project_members
    ↓
12. Modal refreshes members list
```

### View Members Flow
```
1. Modal opens
   ↓
2. Calls ProjectMemberService.getProjectMembers(projectId)
   ↓
3. Service → RPC call → get_project_members_for_user(projectId, currentUserId)
   ↓
4. Function checks if user is admin OR member of project
   ↓
5. Returns members with JOIN to user_profiles
   ↓
6. Service transforms data to ProjectMember[]
   ↓
7. Table displays members
```

## 📁 Files tạo/sửa

### Migrations (Database)
- ✅ `migrations/create_project_members_system.sql` (Initial - có vấn đề)
- ✅ `migrations/update_project_members_system.sql` (Updated version)
- ✅ `migrations/fix_rls_policies_recursion.sql` (First RLS fix)
- ✅ `migrations/fix_rls_policies_final.sql` (Simplified RLS)
- ✅ `migrations/cleanup_duplicate_functions.sql` (Remove duplicates)
- ✅ `migrations/fix_ambiguous_column.sql` (Qualify columns)
- ✅ `migrations/final_fix_all_issues.sql` (Column mapping)
- ✅ `migrations/comprehensive_fix_all_member_issues.sql` (FINAL - Complete fix)

### Frontend
- ✅ `src/components/project/ProjectMemberManagement.tsx` (New component)
- ✅ `src/components/project/ProjectManagement.tsx` (Updated - add members button)
- ✅ `src/services/projectMemberService.ts` (New service)
- ✅ `src/services/projectService.ts` (Updated - filter by membership)
- ✅ `src/contexts/ProjectContext.tsx` (Fixed - use project_id not id)
- ✅ `src/App.tsx` (Fixed - ProjectProvider hierarchy)

### Types
- ✅ `src/types/project.ts` (Added ProjectMember interface)

## 🎓 Lessons Learned

### 1. RLS Complexity
**Problem:** Complex RLS policies cause infinite recursion
**Solution:** Keep RLS simple (admin-only), use SECURITY DEFINER for business logic

### 2. Type Consistency
**Problem:** Mixed UUID/INTEGER for project identification
**Solution:** Stick to ONE type for each purpose:
- `projects.id` (UUID) - cho foreign keys khác
- `projects.project_id` (INTEGER) - cho business logic, RPC calls

### 3. Function Overloading
**Problem:** PostgreSQL cho phép multiple functions cùng tên
**Solution:** Always drop ALL variations before recreate

### 4. Column Ambiguity
**Problem:** JOIN nhiều tables với cùng column names
**Solution:** Always qualify với table alias (pm.role, up.role)

### 5. Service Layer Pattern
**Problem:** Direct Supabase queries trigger RLS issues
**Solution:** Wrap trong SECURITY DEFINER functions, service layer chỉ call RPC

## 🚀 Next Steps

1. **Test toàn bộ flow với các roles:**
   - Admin: Full access
   - Manager: Can manage members
   - Product Editor: Cannot manage members
   - Viewer: Cannot manage members

2. **Test edge cases:**
   - Add user already member → Error
   - Non-manager tries to add → Permission denied
   - Update own role → Should be prevented
   - Remove last admin → Should be prevented

3. **UI Enhancements:**
   - Show member count on project card
   - Filter/search members
   - Bulk actions
   - Invitation system (nếu cần)

4. **Email Module** (Deferred):
   - Email Settings
   - Email Templates
   - Email Logs
   - Email sending integration

## 📊 Database Stats

```sql
-- Check project_roles
SELECT COUNT(*) FROM project_roles;  -- 5 roles

-- Check project_members
SELECT COUNT(*) FROM project_members WHERE status = 'active';

-- Check functions
SELECT COUNT(*) FROM pg_proc WHERE proname LIKE 'get_%' OR proname LIKE 'add_%';
-- Should be 6 functions total
```

## 🔗 Related Documentation

- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [TypeScript Strict Mode](https://www.typescriptlang.org/tsconfig#strict)
