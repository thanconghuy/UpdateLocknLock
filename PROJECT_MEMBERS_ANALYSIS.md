# 📊 PHÂN TÍCH TOÀN DIỆN HỆ THỐNG QUẢN LÝ THÀNH VIÊN PROJECT

> **Tài liệu:** Phân tích kiến trúc, vấn đề và đề xuất giải pháp mới
> **Ngày:** 2025-10-02
> **Mục đích:** Làm mới hoàn toàn module quản lý thành viên project

---

## 📋 MỤC LỤC

1. [Tổng quan hệ thống hiện tại](#1-tổng-quan-hệ-thống-hiện-tại)
2. [Phân tích cấu trúc Database](#2-phân-tích-cấu-trúc-database)
3. [Phân tích mối quan hệ giữa các bảng](#3-phân-tích-mối-quan-hệ-giữa-các-bảng)
4. [Vấn đề của code cũ](#4-vấn-đề-của-code-cũ)
5. [Logic nghiệp vụ và phân quyền](#5-logic-nghiệp-vụ-và-phân-quyền)
6. [Đề xuất kiến trúc mới](#6-đề-xuất-kiến-trúc-mới)
7. [Kế hoạch thực hiện](#7-kế-hoạch-thực-hiện)

---

## 1. TỔNG QUAN HỆ THỐNG HIỆN TẠI

### 1.1 Mô tả hệ thống

Hệ thống quản lý projects với WooCommerce integration, cho phép:
- Quản lý nhiều projects độc lập
- Mỗi project kết nối với một WooCommerce store riêng
- Phân quyền người dùng ở 2 cấp độ:
  - **System level:** admin, manager, editor, viewer (toàn hệ thống)
  - **Project level:** admin, manager, product_editor, project_viewer, viewer (từng project)

### 1.2 Các thành phần chính

```
┌─────────────────────────────────────────────────────────┐
│                     USER LAYER                          │
│  - Authentication (Supabase Auth)                       │
│  - User Profiles (user_profiles table)                  │
│  - System Roles (admin, manager, editor, viewer)        │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   PROJECT LAYER                         │
│  - Projects (projects table)                            │
│  - Project Ownership (owner_id, manager_id)             │
│  - WooCommerce Config (per-project)                     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              PROJECT MEMBERS LAYER (VẤN ĐỀ)             │
│  - Project Members (project_members table)              │
│  - Project Roles (project_roles table)                  │
│  - Permissions (JSONB)                                  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. PHÂN TÍCH CẤU TRÚC DATABASE

### 2.1 Bảng `user_profiles`

**Mục đích:** Quản lý thông tin người dùng và vai trò hệ thống

```sql
TABLE user_profiles (
  id                UUID PRIMARY KEY,           -- Supabase Auth UID
  email             VARCHAR UNIQUE NOT NULL,    -- Email đăng nhập
  full_name         VARCHAR,                    -- Tên đầy đủ
  role              VARCHAR NOT NULL,           -- System role: admin|manager|editor|viewer
  primary_role_id   UUID,                       -- FK to roles table
  is_active         BOOLEAN DEFAULT TRUE,       -- Trạng thái kích hoạt
  must_change_password BOOLEAN DEFAULT FALSE,   -- Bắt buộc đổi mật khẩu
  created_at        TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ
)
```

**Đặc điểm quan trọng:**
- ✅ Sử dụng `auth.uid()` từ Supabase Auth
- ✅ System role độc lập với project role
- ✅ Có thể active/deactive user
- ⚠️ Role được lưu trực tiếp (denormalized) để query nhanh

**Vai trò hệ thống (System Roles):**
```typescript
'admin'   → Level 10 → Toàn quyền hệ thống
'manager' → Level 8  → Quản lý users, projects
'editor'  → Level 6  → Chỉnh sửa nội dung
'viewer'  → Level 4  → Chỉ xem
```

---

### 2.2 Bảng `projects`

**Mục đích:** Quản lý các dự án và cấu hình WooCommerce

```sql
TABLE projects (
  id                        UUID PRIMARY KEY,      -- UUID (legacy)
  project_id                SERIAL UNIQUE,         -- INTEGER (business key) ⚠️
  name                      VARCHAR NOT NULL,
  description               TEXT,
  slug                      VARCHAR UNIQUE,

  -- Ownership
  owner_id                  UUID REFERENCES user_profiles(id),    -- Người tạo
  manager_id                UUID REFERENCES user_profiles(id),    -- Quản lý chính

  -- WooCommerce Config (per-project)
  woocommerce_base_url      VARCHAR NOT NULL,
  woocommerce_consumer_key  VARCHAR NOT NULL,
  woocommerce_consumer_secret VARCHAR NOT NULL,
  woocommerce_store_id      INTEGER,              -- FK to woocommerce_stores

  -- Database Tables
  products_table            VARCHAR,               -- Tên bảng products
  audit_table               VARCHAR,               -- Tên bảng audit log

  -- Settings
  settings                  JSONB DEFAULT '{}',
  is_active                 BOOLEAN DEFAULT TRUE,
  max_members               INTEGER DEFAULT 10,

  -- Timestamps
  created_at                TIMESTAMPTZ,
  updated_at                TIMESTAMPTZ,
  deleted_at                TIMESTAMPTZ           -- Soft delete
)
```

**Vấn đề quan trọng - Dual ID System:**

```typescript
// ❌ VẤN ĐỀ: Có 2 loại ID
Project {
  id: UUID           // '550e8400-e29b-41d4-a716-446655440000'
  project_id: number // 463
}

// ⚠️ NGUYÊN NHÂN LỖI:
// - Frontend đôi khi dùng project.id (UUID)
// - Database functions yêu cầu project_id (INTEGER)
// - Gây lỗi type mismatch: "uuid = integer"
```

**Giải pháp đề xuất:**
- Chỉ sử dụng `project_id` (INTEGER) cho business logic
- Giữ `id` (UUID) cho backward compatibility
- Luôn pass `project_id` vào RPC functions

---

### 2.3 Bảng `project_roles`

**Mục đích:** Định nghĩa các vai trò trong project (template)

```sql
TABLE project_roles (
  id                  SERIAL PRIMARY KEY,
  name                VARCHAR(50) UNIQUE NOT NULL,     -- Tên role
  display_name        VARCHAR(100) NOT NULL,           -- Tên hiển thị
  description         TEXT,                            -- Mô tả
  level               INTEGER NOT NULL,                -- Cấp độ quyền hạn
  default_permissions JSONB DEFAULT '{}',              -- Permissions mặc định
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ
)
```

**4 Project Roles mặc định (đồng bộ với System Roles):**

| ID | Name | Display Name | Level | Permissions |
|---|---|---|---|---|
| 1 | admin | Quản trị viên | 100 | Full quyền: quản lý project, members, products, WooCommerce |
| 2 | manager | Người quản lý | 80 | Quản lý members & products, không xóa project |
| 3 | editor | Biên tập viên | 60 | Chỉnh sửa products & sync WooCommerce |
| 4 | viewer | Người xem | 40 | Xem project & products, không chỉnh sửa |

**Default Permissions (admin):**
```json
{
  "can_edit_project": true,
  "can_edit_products": true,
  "can_delete_project": true,
  "can_manage_members": true,
  "can_view_analytics": true,
  "can_manage_woocommerce": true
}
```

---

### 2.4 Bảng `project_members` (⚠️ VẤN ĐỀ CHÍNH)

**Mục đích:** Quản lý thành viên của từng project

```sql
TABLE project_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  project_id      INTEGER NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role            VARCHAR(50) NOT NULL DEFAULT 'viewer'
                    REFERENCES project_roles(name) ON UPDATE CASCADE,

  -- Metadata
  status          VARCHAR(20) DEFAULT 'active'
                    CHECK (status IN ('active', 'removed', 'suspended')),
  invited_by      UUID REFERENCES user_profiles(id),
  permissions     JSONB DEFAULT '{}',          -- Custom override permissions
  notes           TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),   -- ⚠️ TRONG SCHEMA
  assigned_at     TIMESTAMPTZ DEFAULT NOW(),   -- ⚠️ TRONG FUNCTIONS (alias)
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(project_id, user_id)                  -- 1 user = 1 role/project
)
```

**⚠️ VẤN ĐỀ CRITICAL:**

1. **Column name mismatch:**
   ```sql
   -- Table schema có:
   created_at TIMESTAMPTZ

   -- Functions query:
   SELECT pm.assigned_at  -- ❌ Column không tồn tại!

   -- Error: column pm.assigned_at does not exist
   ```

2. **Ambiguous column reference:**
   ```sql
   SELECT role FROM project_members pm
   JOIN user_profiles up ...
   -- ❌ Error: column "role" is ambiguous
   -- Cả 2 table đều có column "role"
   ```

3. **RLS Infinite Recursion:**
   ```sql
   -- Policy kiểm tra project_members để grant access vào project_members
   CREATE POLICY "Users see members of their projects"
   ON project_members FOR SELECT
   USING (
     auth.uid() IN (
       SELECT user_id FROM project_members  -- ❌ Infinite loop!
       WHERE project_id = project_members.project_id
     )
   );
   ```

---

## 3. PHÂN TÍCH MỐI QUAN HỆ GIỮA CÁC BẢNG

### 3.1 Sơ đồ quan hệ (ERD)

```
┌──────────────────────┐
│   user_profiles      │
│  ──────────────────  │
│  • id (UUID) PK      │◄──────────┐
│  • email             │           │
│  • role (system)     │           │ owner_id, manager_id
│  • is_active         │           │
└──────────────────────┘           │
         △                         │
         │                         │
         │ user_id           ┌─────────────────────┐
         │                   │    projects         │
         │                   │  ─────────────────  │
         │                   │  • id (UUID) PK     │
         │                   │  • project_id (INT) │◄─────┐
         │                   │  • name             │      │
         │                   │  • owner_id (UUID)  │──────┘
         │                   │  • manager_id (UUID)│
         │                   │  • is_active        │
         │                   └─────────────────────┘
         │                            △
         │                            │ project_id (INTEGER)
         │                            │
         │                   ┌────────────────────┐
         │                   │ project_members    │
         │                   │  ────────────────  │
         └───────────────────┤  • id (UUID) PK    │
                             │  • project_id (INT)│
                             │  • user_id (UUID)  │
                             │  • role (project)  │◄────┐
                             │  • status          │     │
                             │  • permissions     │     │
                             │  • created_at      │     │ role (name)
                             └────────────────────┘     │
                                                        │
                                               ┌────────────────────┐
                                               │  project_roles     │
                                               │  ────────────────  │
                                               │  • id (SERIAL) PK  │
                                               │  • name (VARCHAR)  │
                                               │  • level (INT)     │
                                               │  • default_perms   │
                                               └────────────────────┘
```

### 3.2 Phân tích mối quan hệ

#### 3.2.1 User → Project (Ownership)

```typescript
// Mối quan hệ trực tiếp
Project {
  owner_id: UUID    // Người tạo project (toàn quyền)
  manager_id: UUID  // Người quản lý chính (delegated admin)
}

// Logic:
// - owner_id LUÔN có quyền admin trong project đó
// - manager_id có quyền manager (nếu được set)
// - Không lưu trong project_members (implicit)
```

**⚠️ VẤN ĐỀ:**
- Owner/Manager không được lưu trong `project_members`
- Cần check ở 2 nơi: `projects.owner_id` VÀ `project_members`
- Logic phân tán, dễ thiếu sót

#### 3.2.2 User → Project (Membership)

```typescript
// Mối quan hệ qua project_members
ProjectMember {
  project_id: number  // ⚠️ INTEGER, không phải UUID
  user_id: UUID
  role: 'admin' | 'manager' | 'editor' | 'viewer'  // 4 roles đồng bộ
  status: 'active' | 'removed' | 'suspended'
}

// Logic:
// - 1 user chỉ có 1 role trong 1 project (UNIQUE constraint)
// - Role lấy từ project_roles.name
// - Permissions = project_roles.default_permissions + custom overrides
// - Role name mapping với System roles (admin, manager, editor, viewer)
```

#### 3.2.3 Project Member → Project Role (Template)

```typescript
// project_members.role → project_roles.name (FK)
//
// Example:
ProjectMember {
  role: 'manager'  // FK to project_roles.name
}

// Lookup permissions:
ProjectRole {
  name: 'manager'
  level: 80
  default_permissions: {
    can_manage_members: true,
    can_edit_products: true,
    // ...
  }
}

// Final permissions = default_permissions + project_members.permissions (override)
```

---

## 4. VẤN ĐỀ CỦA CODE CŨ

### 4.1 Vấn đề Database Schema

#### ❌ Vấn đề 1: Column Name Mismatch

**Mô tả:**
- Schema định nghĩa: `created_at TIMESTAMPTZ`
- Functions sử dụng: `assigned_at`
- Gây lỗi: `column pm.assigned_at does not exist`

**Nguyên nhân:**
- Nhiều lần migration không đồng bộ
- Không có single source of truth

**Impact:** 🔴 CRITICAL - App không chạy được

---

#### ❌ Vấn đề 2: RLS Infinite Recursion

**Mô tả:**
```sql
-- Policy này gây infinite loop
CREATE POLICY "Users see members of their projects"
ON project_members FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM project_members  -- ❌ Query chính bảng đang set policy
    WHERE project_id = project_members.project_id
  )
);
```

**Giải thích:**
1. User query `project_members` table
2. RLS policy kích hoạt → Query lại `project_members` để check
3. RLS policy kích hoạt lại → Infinite loop

**Impact:** 🔴 CRITICAL - PostgreSQL error, app crash

---

#### ❌ Vấn đề 3: Ambiguous Column References

**Mô tả:**
```sql
SELECT
  pm.id,
  pm.project_id,
  pm.user_id,
  role,              -- ❌ Thuộc pm hay up?
  up.email,
  up.full_name
FROM project_members pm
JOIN user_profiles up ON pm.user_id = up.id
```

**Nguyên nhân:**
- Cả `project_members.role` và `user_profiles.role` đều tồn tại
- Không qualify column với table alias

**Impact:** 🟡 MEDIUM - SQL error khi query

---

#### ❌ Vấn đề 4: Type Mismatch (UUID vs INTEGER)

**Mô tả:**
```typescript
// Frontend code
const handleOpenMembers = (project: Project) => {
  setSelectedProject(project.id)  // ❌ UUID
}

// Service call
await projectMemberService.getMembers(selectedProject)
  // ❌ Pass UUID nhưng function cần INTEGER
```

**Nguyên nhân:**
- Project có 2 IDs: `id` (UUID) và `project_id` (INTEGER)
- Code không consistent

**Impact:** 🔴 CRITICAL - `operator does not exist: uuid = integer`

---

### 4.2 Vấn đề Service Layer

#### ❌ Vấn đề 5: Direct Supabase Queries Trigger RLS

**Code cũ:**
```typescript
// ❌ BAD: Direct query trigger RLS
async getAvailableUsers(projectId: number) {
  const { data: existingMembers } = await supabase
    .from('project_members')  // ❌ RLS check → infinite recursion
    .select('user_id')
    .eq('project_id', projectId)

  const { data: allUsers } = await supabase
    .from('user_profiles')
    .select('*')
    .not('id', 'in', existingMembers.map(m => m.user_id))

  return allUsers
}
```

**Vấn đề:**
- Query `project_members` trigger RLS policy
- RLS policy lại query `project_members` → Infinite loop

---

#### ❌ Vấn đề 6: Duplicate Functions & Unclear Signatures

**Mô tả:**
```sql
-- Migration 1
CREATE FUNCTION get_project_members(p_project_id INTEGER) ...

-- Migration 2
CREATE FUNCTION get_project_members(p_project_id UUID) ...

-- Migration 3
CREATE FUNCTION get_project_members_for_user(p_project_id INTEGER, p_user_id UUID) ...

-- PostgreSQL error: "Could not choose the best candidate function"
```

**Nguyên nhân:**
- Nhiều migrations không drop functions cũ
- Function overloading không rõ ràng

**Impact:** 🔴 CRITICAL - RPC calls fail

---

### 4.3 Vấn đề Frontend Components

#### ❌ Vấn đề 7: Component Hierarchy Circular Dependency

**Code cũ (App.tsx):**
```tsx
<ProtectedRoute>
  <ProjectProvider>  {/* ❌ ProjectProvider bên trong ProtectedRoute */}
    <Routes>
      <Route path="/projects" element={<ProjectManagement />} />
    </Routes>
  </ProjectProvider>
</ProtectedRoute>
```

**Vấn đề:**
- `ProtectedRoute` cần `ProjectProvider` để check permissions
- `ProjectProvider` cần `ProtectedRoute` để authenticate
- Circular dependency → App stuck on "Loading Projects..."

**Impact:** 🔴 CRITICAL - App không load được

---

#### ❌ Vấn đề 8: Error Handling Không Đầy Đủ

**Code cũ:**
```typescript
async addMember(projectId: number, userId: string, role: string) {
  const { data, error } = await supabase.rpc('add_project_member', {
    p_project_id: projectId,
    p_user_id: userId,
    p_role: role
  })

  if (error) {
    console.error(error)  // ❌ Chỉ log, không throw
  }

  return data  // ❌ Có thể undefined nếu có error
}
```

**Vấn đề:**
- Không throw error → Component không biết thất bại
- Không có user-friendly error messages
- Không retry logic

---

## 5. LOGIC NGHIỆP VỤ VÀ PHÂN QUYỀN

### 5.1 Phân cấp quyền hạn

#### System Level (toàn hệ thống) - 4 cấp độ

```typescript
System Roles: (Quản lý toàn bộ hệ thống)
┌─────────────────────────────────────────────────────┐
│ admin (Level 100)                                   │
│  ✅ Toàn quyền: quản lý users, projects, settings  │
│  ✅ Truy cập mọi project (implicit admin role)     │
│  ✅ Bypass RLS policies (SECURITY DEFINER)         │
│  ✅ Quản lý system settings                        │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ manager (Level 80)                                  │
│  ✅ Quản lý users (create, update, deactivate)     │
│  ✅ Quản lý projects (create, update)              │
│  ❌ Không xóa users/projects                       │
│  ❌ Không sửa system settings                      │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ editor (Level 60)                                   │
│  ✅ Chỉnh sửa nội dung trong assigned projects     │
│  ✅ Được assign vào projects để làm việc           │
│  ❌ Không quản lý users/projects                   │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ viewer (Level 40)                                   │
│  ✅ Chỉ xem dữ liệu được phân quyền                │
│  ✅ Có thể được assign vào projects                │
│  ❌ Không chỉnh sửa gì                             │
└─────────────────────────────────────────────────────┘
```

#### Project Level (từng project) - 4 cấp độ (mapping với System Level)

```typescript
Project Roles: (Quyền trong từng project cụ thể)
┌─────────────────────────────────────────────────────┐
│ admin (Level 100) ← Mapping với System admin       │
│  ✅ Toàn quyền trong project                       │
│  ✅ Quản lý members, products, settings            │
│  ✅ Xóa project                                    │
│  ✅ Cấu hình WooCommerce                           │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ manager (Level 80) ← Mapping với System manager    │
│  ✅ Quản lý members & products                     │
│  ✅ Cấu hình WooCommerce                           │
│  ✅ Chỉnh sửa project settings                     │
│  ❌ Không xóa project                              │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ editor (Level 60) ← Mapping với System editor      │
│  ✅ Chỉnh sửa products                             │
│  ✅ Sync WooCommerce                               │
│  ✅ Xem analytics                                  │
│  ❌ Không quản lý members                          │
│  ❌ Không sửa project settings                     │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ viewer (Level 40) ← Mapping với System viewer      │
│  ✅ Xem project & products                         │
│  ✅ Xem analytics (read-only)                      │
│  ❌ Không chỉnh sửa gì cả                          │
│  ❌ Không sync WooCommerce                         │
└─────────────────────────────────────────────────────┘
```

**🔄 Mapping Logic:**

| System Role | Default Project Role | Can Assign To | Description |
|-------------|---------------------|---------------|-------------|
| admin | admin | admin, manager, editor, viewer | Tự động có quyền admin trong mọi project |
| manager | manager | manager, editor, viewer | Có thể được assign làm manager hoặc thấp hơn |
| editor | editor | editor, viewer | Có thể được assign làm editor hoặc viewer |
| viewer | viewer | viewer | Chỉ có thể được assign làm viewer |

**📌 Nguyên tắc đồng bộ 4 cấp độ:**
- ✅ System role quyết định quyền tối đa có thể có trong project
- ✅ Có thể assign project role thấp hơn hoặc bằng system role
- ❌ Không thể assign project role cao hơn system role
- ✅ Tên role giống nhau giữa System và Project (admin, manager, editor, viewer)

### 5.2 Logic phân quyền chi tiết

#### Quyền xem danh sách members

```typescript
// Ai có thể xem danh sách members của project?
canViewMembers(userId, projectId):
  1. System Admin → TRUE (toàn quyền)
  2. Project Owner (projects.owner_id) → TRUE
  3. Project Member với status='active' → TRUE
  4. Người khác → FALSE
```

#### Quyền quản lý members (add/remove/update)

```typescript
// Ai có thể quản lý members?
canManageMembers(userId, projectId):
  1. System Admin → TRUE
  2. Project Owner → TRUE
  3. Project Member với role level >= 80 (admin, manager) → TRUE
  4. Người khác → FALSE
```

#### Quyền chọn role khi thêm member

```typescript
// User có thể assign role nào cho member mới?
getAssignableRoles(userId, projectId):
  1. System Admin → Tất cả roles
  2. Project Admin → Tất cả roles
  3. Project Manager → Roles có level < 100 (không assign admin)
  4. Người khác → []
```

### 5.3 Business Rules

#### Rule 1: Một user chỉ có một role trong một project
```sql
UNIQUE(project_id, user_id)
```

#### Rule 2: Owner luôn là admin implicit
```typescript
// Không cần lưu trong project_members
if (userId === project.owner_id) {
  return 'admin'
}
```

#### Rule 3: System admin có quyền admin trong mọi project
```typescript
if (userProfile.role === 'admin') {
  return {
    role: 'admin',
    permissions: ALL_PERMISSIONS
  }
}
```

#### Rule 4: Không thể xóa chính mình khỏi project
```typescript
if (memberToRemove.user_id === currentUser.id) {
  throw new Error('Không thể xóa chính mình khỏi project')
}
```

#### Rule 5: Phải có ít nhất 1 admin trong project
```typescript
if (isLastAdmin && action === 'remove') {
  throw new Error('Phải có ít nhất 1 admin trong project')
}
```

---

## 6. ĐỀ XUẤT KIẾN TRÚC MỚI

### 6.1 Nguyên tắc thiết kế

#### ✅ Principle 1: Single Source of Truth
- Schema được định nghĩa rõ ràng trong 1 migration duy nhất
- Không có duplicate functions
- Column names consistent trong toàn bộ hệ thống

#### ✅ Principle 2: Separation of Concerns
- **Database Layer:** Tables, RLS, Functions (SECURITY DEFINER)
- **Service Layer:** Business logic, error handling, data transformation
- **Component Layer:** UI, user interactions, state management

#### ✅ Principle 3: Fail-Safe Design
- RLS policies đơn giản (chỉ admin)
- Business logic trong SECURITY DEFINER functions
- Comprehensive error handling

#### ✅ Principle 4: Type Safety
- Chỉ dùng `project_id` (INTEGER) cho business logic
- Clear TypeScript interfaces
- Validation ở mọi layer

### 6.2 Kiến trúc 3 lớp mới

```
┌──────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ProjectMembersModal.tsx (MỚI)                     │  │
│  │  - Display members list                            │  │
│  │  - Add member form                                 │  │
│  │  - Update/Remove actions                           │  │
│  │  - Error handling & loading states                 │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│                     SERVICE LAYER                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ProjectMembersService.ts (MỚI - CLASS-BASED)      │  │
│  │                                                     │  │
│  │  class ProjectMembersService {                     │  │
│  │    async getMembers(projectId): Promise<Member[]>  │  │
│  │    async getAvailableUsers(projectId)              │  │
│  │    async addMember(projectId, userId, role)        │  │
│  │    async updateMemberRole(memberId, role)          │  │
│  │    async removeMember(memberId)                    │  │
│  │    async checkPermissions(userId, projectId)       │  │
│  │  }                                                  │  │
│  │                                                     │  │
│  │  - RPC calls only (no direct queries)              │  │
│  │  - Error transformation                            │  │
│  │  - Data validation                                 │  │
│  │  - Type safety                                     │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Functions (SECURITY DEFINER)           │  │
│  │                                                     │  │
│  │  • get_project_members(p_project_id INT, ...)      │  │
│  │  • get_available_users_for_project(...)            │  │
│  │  • add_project_member(...)                         │  │
│  │  • update_project_member_role(...)                 │  │
│  │  • remove_project_member(...)                      │  │
│  │  • check_user_permissions(...)                     │  │
│  │                                                     │  │
│  │  - Bypass RLS (SECURITY DEFINER)                   │  │
│  │  - Permission checking                             │  │
│  │  - Business rules enforcement                      │  │
│  └────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────┐  │
│  │  RLS Policies (SIMPLIFIED)                         │  │
│  │                                                     │  │
│  │  • Admin-only direct access                        │  │
│  │  • All others use SECURITY DEFINER functions       │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 6.3 Database Schema Mới (Clean)

#### Migration: `reset_project_members_system.sql`

```sql
-- =====================================================
-- CLEAN RESET: Project Members System
-- =====================================================

-- Step 1: Drop tất cả code cũ
DROP POLICY IF EXISTS "Users see members of their projects" ON project_members;
DROP POLICY IF EXISTS "Admins and project managers can add members" ON project_members;
DROP POLICY IF EXISTS "Admins and project managers can update members" ON project_members;
DROP POLICY IF EXISTS "Admins and project admins can delete members" ON project_members;

DROP FUNCTION IF EXISTS get_project_members CASCADE;
DROP FUNCTION IF EXISTS get_project_members_for_user CASCADE;
DROP FUNCTION IF EXISTS get_available_users_for_project CASCADE;
DROP FUNCTION IF EXISTS add_project_member CASCADE;
DROP FUNCTION IF EXISTS update_project_member_role CASCADE;
DROP FUNCTION IF EXISTS remove_project_member CASCADE;
DROP FUNCTION IF EXISTS can_user_manage_members CASCADE;
DROP FUNCTION IF EXISTS get_user_project_role CASCADE;
DROP FUNCTION IF EXISTS get_user_project_permissions CASCADE;

-- Step 2: Recreate table với schema rõ ràng
DROP TABLE IF EXISTS project_members CASCADE;

CREATE TABLE project_members (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys (⚠️ CHÚ Ý: project_id là INTEGER)
  project_id INTEGER NOT NULL
    REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id UUID NOT NULL
    REFERENCES user_profiles(id) ON DELETE CASCADE,

  -- Role & Status
  role VARCHAR(50) NOT NULL DEFAULT 'viewer'
    REFERENCES project_roles(name) ON UPDATE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'removed', 'suspended')),

  -- Permissions & Metadata
  permissions JSONB DEFAULT '{}',  -- Override default_permissions
  notes TEXT,
  invited_by UUID REFERENCES user_profiles(id),

  -- Timestamps (⚠️ CONSISTENT NAMING)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  UNIQUE(project_id, user_id)
);

-- Indexes
CREATE INDEX idx_pm_project ON project_members(project_id);
CREATE INDEX idx_pm_user ON project_members(user_id);
CREATE INDEX idx_pm_status ON project_members(status);
CREATE INDEX idx_pm_role ON project_members(role);
CREATE INDEX idx_pm_composite ON project_members(project_id, user_id, status);

-- Step 3: Simple RLS (Admin-only)
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_admins_full_access"
ON project_members FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Step 4: SECURITY DEFINER Functions (Business Logic)
-- (Xem section 6.4 bên dưới)
```

### 6.4 Database Functions Mới

#### Function 1: Get Project Members

```sql
CREATE OR REPLACE FUNCTION get_project_members(
  p_project_id INTEGER,
  p_requesting_user_id UUID
)
RETURNS TABLE (
  member_id UUID,
  project_id INTEGER,
  user_id UUID,
  user_email VARCHAR,
  user_full_name VARCHAR,
  user_system_role VARCHAR,
  project_role VARCHAR,
  status VARCHAR,
  permissions JSONB,
  created_at TIMESTAMPTZ,
  invited_by UUID
) AS $$
BEGIN
  -- Permission check
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = p_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project member
    EXISTS (SELECT 1 FROM project_members WHERE project_id = p_project_id AND user_id = p_requesting_user_id AND status = 'active')
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot view members of this project';
  END IF;

  -- Return members với JOIN
  RETURN QUERY
  SELECT
    pm.id AS member_id,
    pm.project_id,
    pm.user_id,
    up.email AS user_email,
    up.full_name AS user_full_name,
    up.role AS user_system_role,
    pm.role AS project_role,
    pm.status,
    COALESCE(
      pm.permissions,
      (SELECT default_permissions FROM project_roles WHERE name = pm.role)
    ) AS permissions,
    pm.created_at,
    pm.invited_by
  FROM project_members pm
  JOIN user_profiles up ON pm.user_id = up.id
  WHERE pm.project_id = p_project_id
    AND pm.status = 'active'
  ORDER BY pm.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_project_members TO authenticated;
```

#### Function 2: Get Available Users

```sql
CREATE OR REPLACE FUNCTION get_available_users_for_project(
  p_project_id INTEGER,
  p_requesting_user_id UUID
)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  full_name VARCHAR,
  system_role VARCHAR,
  is_active BOOLEAN
) AS $$
BEGIN
  -- Permission check: Chỉ admin hoặc manager mới xem
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = p_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project admin/manager
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN project_roles pr ON pm.role = pr.name
      WHERE pm.project_id = p_project_id
        AND pm.user_id = p_requesting_user_id
        AND pm.status = 'active'
        AND pr.level >= 80
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot manage members of this project';
  END IF;

  -- Return users chưa là member
  RETURN QUERY
  SELECT
    up.id AS user_id,
    up.email,
    up.full_name,
    up.role AS system_role,
    up.is_active
  FROM user_profiles up
  WHERE up.is_active = TRUE
    AND up.id NOT IN (
      SELECT pm.user_id
      FROM project_members pm
      WHERE pm.project_id = p_project_id
        AND pm.status = 'active'
    )
  ORDER BY up.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_available_users_for_project TO authenticated;
```

#### Function 3: Add Project Member

```sql
CREATE OR REPLACE FUNCTION add_project_member(
  p_project_id INTEGER,
  p_user_id UUID,
  p_role VARCHAR,
  p_requesting_user_id UUID,
  p_custom_permissions JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_new_member_id UUID;
  v_requesting_user_level INTEGER;
  v_new_role_level INTEGER;
BEGIN
  -- Permission check
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = p_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project admin/manager
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN project_roles pr ON pm.role = pr.name
      WHERE pm.project_id = p_project_id
        AND pm.user_id = p_requesting_user_id
        AND pm.status = 'active'
        AND pr.level >= 80
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot manage members of this project';
  END IF;

  -- Get role levels
  SELECT level INTO v_requesting_user_level
  FROM project_members pm
  JOIN project_roles pr ON pm.role = pr.name
  WHERE pm.project_id = p_project_id
    AND pm.user_id = p_requesting_user_id
    AND pm.status = 'active';

  -- System admin hoặc owner → level = 100
  IF v_requesting_user_level IS NULL THEN
    v_requesting_user_level := 100;
  END IF;

  SELECT level INTO v_new_role_level
  FROM project_roles
  WHERE name = p_role;

  -- Business rule: Không thể assign role cao hơn role của mình
  IF v_new_role_level > v_requesting_user_level THEN
    RAISE EXCEPTION 'Permission denied: Cannot assign role higher than your own';
  END IF;

  -- Check user đã là member chưa
  IF EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id
      AND user_id = p_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'User is already a member of this project';
  END IF;

  -- Insert member
  INSERT INTO project_members (
    project_id,
    user_id,
    role,
    status,
    permissions,
    invited_by
  ) VALUES (
    p_project_id,
    p_user_id,
    p_role,
    'active',
    p_custom_permissions,
    p_requesting_user_id
  )
  RETURNING id INTO v_new_member_id;

  RETURN v_new_member_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION add_project_member TO authenticated;
```

#### Function 4: Update Member Role

```sql
CREATE OR REPLACE FUNCTION update_project_member_role(
  p_member_id UUID,
  p_new_role VARCHAR,
  p_requesting_user_id UUID,
  p_custom_permissions JSONB DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id INTEGER;
  v_target_user_id UUID;
  v_requesting_user_level INTEGER;
  v_new_role_level INTEGER;
BEGIN
  -- Get member info
  SELECT project_id, user_id INTO v_project_id, v_target_user_id
  FROM project_members
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Permission check
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = v_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project admin/manager
    EXISTS (
      SELECT 1 FROM project_members pm
      JOIN project_roles pr ON pm.role = pr.name
      WHERE pm.project_id = v_project_id
        AND pm.user_id = p_requesting_user_id
        AND pm.status = 'active'
        AND pr.level >= 80
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot manage members of this project';
  END IF;

  -- Business rule: Không thể update role của chính mình
  IF v_target_user_id = p_requesting_user_id THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  -- Get role levels
  SELECT level INTO v_requesting_user_level
  FROM project_members pm
  JOIN project_roles pr ON pm.role = pr.name
  WHERE pm.project_id = v_project_id
    AND pm.user_id = p_requesting_user_id
    AND pm.status = 'active';

  IF v_requesting_user_level IS NULL THEN
    v_requesting_user_level := 100;
  END IF;

  SELECT level INTO v_new_role_level
  FROM project_roles
  WHERE name = p_new_role;

  -- Business rule: Không thể assign role cao hơn role của mình
  IF v_new_role_level > v_requesting_user_level THEN
    RAISE EXCEPTION 'Permission denied: Cannot assign role higher than your own';
  END IF;

  -- Update
  UPDATE project_members
  SET
    role = p_new_role,
    permissions = COALESCE(p_custom_permissions, permissions),
    updated_at = NOW()
  WHERE id = p_member_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_project_member_role TO authenticated;
```

#### Function 5: Remove Member

```sql
CREATE OR REPLACE FUNCTION remove_project_member(
  p_member_id UUID,
  p_requesting_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_id INTEGER;
  v_target_user_id UUID;
  v_admin_count INTEGER;
BEGIN
  -- Get member info
  SELECT project_id, user_id INTO v_project_id, v_target_user_id
  FROM project_members
  WHERE id = p_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Permission check
  IF NOT (
    -- System admin
    EXISTS (SELECT 1 FROM user_profiles WHERE id = p_requesting_user_id AND role = 'admin')
    OR
    -- Project owner
    EXISTS (SELECT 1 FROM projects WHERE project_id = v_project_id AND owner_id = p_requesting_user_id)
    OR
    -- Project admin
    EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = v_project_id
        AND pm.user_id = p_requesting_user_id
        AND pm.status = 'active'
        AND pm.role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied: You cannot remove members from this project';
  END IF;

  -- Business rule: Không thể remove chính mình
  IF v_target_user_id = p_requesting_user_id THEN
    RAISE EXCEPTION 'Cannot remove yourself from the project';
  END IF;

  -- Business rule: Phải có ít nhất 1 admin
  SELECT COUNT(*) INTO v_admin_count
  FROM project_members
  WHERE project_id = v_project_id
    AND status = 'active'
    AND role = 'admin';

  IF v_admin_count = 1 AND (
    SELECT role FROM project_members WHERE id = p_member_id
  ) = 'admin' THEN
    RAISE EXCEPTION 'Cannot remove the last admin from the project';
  END IF;

  -- Soft delete (set status = removed)
  UPDATE project_members
  SET
    status = 'removed',
    updated_at = NOW()
  WHERE id = p_member_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION remove_project_member TO authenticated;
```

### 6.5 Service Layer Mới (Class-based)

#### File: `src/services/projectMembers/ProjectMembersService.ts`

```typescript
import { supabase } from '@/lib/supabase'

// =====================================================
// TYPES
// =====================================================

export interface ProjectMember {
  member_id: string
  project_id: number
  user_id: string
  user_email: string
  user_full_name: string | null
  user_system_role: string
  project_role: string
  status: string
  permissions: Record<string, boolean>
  created_at: string
  invited_by: string | null
}

export interface AvailableUser {
  user_id: string
  email: string
  full_name: string | null
  system_role: string
  is_active: boolean
}

export interface AddMemberParams {
  projectId: number
  userId: string
  role: string
  customPermissions?: Record<string, boolean>
}

export interface UpdateMemberRoleParams {
  memberId: string
  newRole: string
  customPermissions?: Record<string, boolean>
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class ProjectMembersService {
  /**
   * Get danh sách members của project
   */
  async getMembers(projectId: number, requestingUserId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase.rpc('get_project_members', {
      p_project_id: projectId,
      p_requesting_user_id: requestingUserId
    })

    if (error) {
      console.error('[ProjectMembersService] Error getting members:', error)
      throw new Error(this.formatError(error))
    }

    return data || []
  }

  /**
   * Get danh sách users có thể thêm vào project
   */
  async getAvailableUsers(projectId: number, requestingUserId: string): Promise<AvailableUser[]> {
    const { data, error } = await supabase.rpc('get_available_users_for_project', {
      p_project_id: projectId,
      p_requesting_user_id: requestingUserId
    })

    if (error) {
      console.error('[ProjectMembersService] Error getting available users:', error)
      throw new Error(this.formatError(error))
    }

    return data || []
  }

  /**
   * Thêm member mới vào project
   */
  async addMember(params: AddMemberParams, requestingUserId: string): Promise<string> {
    const { projectId, userId, role, customPermissions } = params

    const { data, error } = await supabase.rpc('add_project_member', {
      p_project_id: projectId,
      p_user_id: userId,
      p_role: role,
      p_requesting_user_id: requestingUserId,
      p_custom_permissions: customPermissions || null
    })

    if (error) {
      console.error('[ProjectMembersService] Error adding member:', error)
      throw new Error(this.formatError(error))
    }

    return data
  }

  /**
   * Cập nhật role của member
   */
  async updateMemberRole(params: UpdateMemberRoleParams, requestingUserId: string): Promise<boolean> {
    const { memberId, newRole, customPermissions } = params

    const { data, error } = await supabase.rpc('update_project_member_role', {
      p_member_id: memberId,
      p_new_role: newRole,
      p_requesting_user_id: requestingUserId,
      p_custom_permissions: customPermissions || null
    })

    if (error) {
      console.error('[ProjectMembersService] Error updating member role:', error)
      throw new Error(this.formatError(error))
    }

    return data
  }

  /**
   * Xóa member khỏi project
   */
  async removeMember(memberId: string, requestingUserId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('remove_project_member', {
      p_member_id: memberId,
      p_requesting_user_id: requestingUserId
    })

    if (error) {
      console.error('[ProjectMembersService] Error removing member:', error)
      throw new Error(this.formatError(error))
    }

    return data
  }

  /**
   * Get danh sách roles có thể assign
   */
  async getAvailableRoles(): Promise<Array<{
    id: number
    name: string
    display_name: string
    description: string
    level: number
  }>> {
    const { data, error } = await supabase
      .from('project_roles')
      .select('id, name, display_name, description, level')
      .eq('is_active', true)
      .order('level', { ascending: false })

    if (error) {
      console.error('[ProjectMembersService] Error getting roles:', error)
      throw new Error('Không thể tải danh sách roles')
    }

    return data || []
  }

  /**
   * Format error message cho user-friendly
   */
  private formatError(error: any): string {
    if (error.message) {
      // PostgreSQL RAISE EXCEPTION messages
      if (error.message.includes('Permission denied')) {
        return 'Bạn không có quyền thực hiện thao tác này'
      }
      if (error.message.includes('already a member')) {
        return 'User này đã là thành viên của project'
      }
      if (error.message.includes('Cannot assign role higher')) {
        return 'Bạn không thể assign role cao hơn role của mình'
      }
      if (error.message.includes('Cannot change your own role')) {
        return 'Bạn không thể thay đổi role của chính mình'
      }
      if (error.message.includes('Cannot remove yourself')) {
        return 'Bạn không thể xóa chính mình khỏi project'
      }
      if (error.message.includes('last admin')) {
        return 'Không thể xóa admin cuối cùng của project'
      }

      return error.message
    }

    return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
  }
}

// Export singleton instance
export const projectMembersService = new ProjectMembersService()
```

### 6.6 Component Layer Mới

#### File: `src/components/project/ProjectMembersModal.tsx`

```typescript
import React, { useState, useEffect } from 'react'
import { X, UserPlus, Trash2, Edit2 } from 'lucide-react'
import { projectMembersService, ProjectMember, AvailableUser } from '@/services/projectMembers/ProjectMembersService'
import { useAuth } from '@/contexts/AuthContext'

interface ProjectMembersModalProps {
  projectId: number
  projectName: string
  onClose: () => void
}

export default function ProjectMembersModal({
  projectId,
  projectName,
  onClose
}: ProjectMembersModalProps) {
  const { userProfile } = useAuth()

  // State
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([])
  const [roles, setRoles] = useState<Array<any>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('viewer')
  const [isAdding, setIsAdding] = useState(false)

  // Load initial data
  useEffect(() => {
    loadData()
  }, [projectId])

  const loadData = async () => {
    if (!userProfile?.id) return

    setLoading(true)
    setError(null)

    try {
      const [membersData, usersData, rolesData] = await Promise.all([
        projectMembersService.getMembers(projectId, userProfile.id),
        projectMembersService.getAvailableUsers(projectId, userProfile.id),
        projectMembersService.getAvailableRoles()
      ])

      setMembers(membersData)
      setAvailableUsers(usersData)
      setRoles(rolesData)
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUserId || !userProfile?.id) return

    setIsAdding(true)
    setError(null)

    try {
      await projectMembersService.addMember({
        projectId,
        userId: selectedUserId,
        role: selectedRole
      }, userProfile.id)

      // Reset form
      setSelectedUserId('')
      setSelectedRole('viewer')

      // Reload data
      await loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!userProfile?.id) return
    if (!confirm('Bạn có chắc muốn xóa thành viên này?')) return

    try {
      await projectMembersService.removeMember(memberId, userProfile.id)
      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    if (!userProfile?.id) return

    try {
      await projectMembersService.updateMemberRole({
        memberId,
        newRole
      }, userProfile.id)

      await loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            Quản lý thành viên - {projectName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Đang tải...</p>
            </div>
          ) : (
            <>
              {/* Add Member Form */}
              <form onSubmit={handleAddMember} className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Thêm thành viên mới
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chọn người dùng
                    </label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      <option value="">-- Chọn user --</option>
                      {availableUsers.map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.email} {user.full_name ? `(${user.full_name})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vai trò
                    </label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      {roles.map(role => (
                        <option key={role.id} value={role.name}>
                          {role.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isAdding || !selectedUserId}
                      className="w-full px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isAdding ? 'Đang thêm...' : 'Thêm thành viên'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Members List */}
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Danh sách thành viên ({members.length})
                </h3>

                {members.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    Chưa có thành viên nào
                  </p>
                ) : (
                  <div className="space-y-2">
                    {members.map(member => (
                      <div
                        key={member.member_id}
                        className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            {member.user_email}
                          </p>
                          {member.user_full_name && (
                            <p className="text-sm text-gray-600">
                              {member.user_full_name}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            System role: {member.user_system_role}
                          </p>
                        </div>

                        <div className="flex items-center space-x-4">
                          <select
                            value={member.project_role}
                            onChange={(e) => handleUpdateRole(member.member_id, e.target.value)}
                            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            {roles.map(role => (
                              <option key={role.id} value={role.name}>
                                {role.display_name}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => handleRemoveMember(member.member_id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Xóa thành viên"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## 7. KẾ HOẠCH THỰC HIỆN

### 7.1 Các bước thực hiện

#### ✅ Phase 1: Clean Up (Xóa code cũ)

**Mục tiêu:** Xóa toàn bộ code cũ để tránh conflict

**Tasks:**
1. Backup database trước khi xóa
2. Xóa các files cũ:
   - `src/components/project/ProjectMemberManagement.tsx`
   - `src/services/projectMemberService.ts`
   - Tất cả migrations cũ trong `migrations/`
3. Drop tất cả functions và policies cũ trong database
4. Commit: "chore: remove old project members module"

**Verification:**
```bash
# Check không còn reference đến code cũ
grep -r "ProjectMemberManagement" src/
grep -r "projectMemberService" src/
```

---

#### ✅ Phase 2: Database Schema (Tạo schema mới)

**Mục tiêu:** Tạo clean database schema với migration duy nhất

**Tasks:**
1. Tạo file migration: `migrations/20251002_reset_project_members_system.sql`
2. Chạy migration trong Supabase SQL Editor
3. Verify schema:
   ```sql
   \d project_members
   \d project_roles
   ```
4. Test functions trực tiếp:
   ```sql
   SELECT * FROM get_project_members(463, '3114ecf0-6473-406d-b4e2-10150b4b09ba'::UUID);
   SELECT * FROM get_available_users_for_project(463, '3114ecf0-6473-406d-b4e2-10150b4b09ba'::UUID);
   ```

**Success Criteria:**
- ✅ Table `project_members` tạo thành công với đúng columns
- ✅ 5 functions tạo thành công
- ✅ RLS policies hoạt động (admin có quyền, non-admin không)
- ✅ Test queries trả về data đúng

---

#### ✅ Phase 3: Service Layer (Tạo service class mới)

**Mục tiêu:** Tạo service layer với proper error handling

**Tasks:**
1. Tạo folder: `src/services/projectMembers/`
2. Tạo file: `ProjectMembersService.ts`
3. Implement class với tất cả methods
4. Export singleton instance
5. Tạo unit tests (optional)

**Success Criteria:**
- ✅ Service methods gọi RPC functions thành công
- ✅ Error handling hoạt động
- ✅ TypeScript types chính xác
- ✅ No compilation errors

---

#### ✅ Phase 4: Component Layer (Tạo UI mới)

**Mục tiêu:** Tạo UI component mới với clean architecture

**Tasks:**
1. Tạo file: `src/components/project/ProjectMembersModal.tsx`
2. Implement component với:
   - List members
   - Add member form
   - Update role
   - Remove member
   - Error handling
   - Loading states
3. Integrate vào `ProjectManagement.tsx`

**Success Criteria:**
- ✅ Modal mở thành công
- ✅ Danh sách members hiển thị
- ✅ Form add member hoạt động
- ✅ Update/Remove actions hoạt động
- ✅ Error messages hiển thị đúng

---

#### ✅ Phase 5: Testing & Refinement

**Mục tiêu:** Test toàn bộ flow với các scenarios khác nhau

**Test Cases:**

| # | Scenario | Expected Result |
|---|---|---|
| 1 | Admin mở modal | ✅ Xem được tất cả members |
| 2 | Manager thêm member | ✅ Thành công |
| 3 | Manager assign role admin | ❌ Error: Cannot assign higher role |
| 4 | Editor mở modal | ❌ Error: Permission denied |
| 5 | Member update own role | ❌ Error: Cannot change own role |
| 6 | Remove last admin | ❌ Error: Last admin cannot be removed |
| 7 | Add existing member | ❌ Error: Already a member |
| 8 | Non-member view members | ❌ Error: Permission denied |

**Tasks:**
1. Test manual với mỗi test case
2. Fix bugs nếu có
3. Optimize performance nếu cần
4. Document edge cases

---

### 7.2 Rollback Plan

Nếu có vấn đề nghiêm trọng, rollback theo thứ tự ngược lại:

1. **Rollback Phase 4:** Xóa component mới, restore component cũ
2. **Rollback Phase 3:** Xóa service class mới
3. **Rollback Phase 2:**
   ```sql
   DROP TABLE project_members CASCADE;
   DROP FUNCTION get_project_members CASCADE;
   -- ... drop tất cả
   ```
   Restore từ backup
4. **Rollback Phase 1:** Restore code cũ từ git

---

### 7.3 Timeline Estimate

| Phase | Estimated Time | Dependencies |
|---|---|---|
| Phase 1: Clean Up | 30 mins | None |
| Phase 2: Database | 2 hours | Phase 1 |
| Phase 3: Service | 1.5 hours | Phase 2 |
| Phase 4: Component | 2 hours | Phase 3 |
| Phase 5: Testing | 1.5 hours | Phase 4 |
| **Total** | **~7.5 hours** | |

---

## 8. CHECKLIST HOÀN THÀNH

### Pre-flight Checklist
- [ ] Backup database hiện tại
- [ ] Backup code hiện tại (git commit)
- [ ] Review toàn bộ tài liệu này
- [ ] Confirm với stakeholder về việc làm mới module

### Phase 1 Checklist
- [ ] Xóa `ProjectMemberManagement.tsx`
- [ ] Xóa `projectMemberService.ts`
- [ ] Xóa migrations cũ
- [ ] Drop functions và policies trong database
- [ ] Commit changes

### Phase 2 Checklist
- [ ] Tạo migration file mới
- [ ] Chạy migration trong Supabase
- [ ] Verify table schema
- [ ] Test tất cả 5 functions
- [ ] Grant permissions
- [ ] Commit migration file

### Phase 3 Checklist
- [ ] Tạo folder structure
- [ ] Implement `ProjectMembersService` class
- [ ] Test service methods
- [ ] Export singleton
- [ ] Commit service code

### Phase 4 Checklist
- [ ] Tạo `ProjectMembersModal.tsx`
- [ ] Implement UI components
- [ ] Integrate vào `ProjectManagement.tsx`
- [ ] Test UI interactions
- [ ] Commit component code

### Phase 5 Checklist
- [ ] Chạy tất cả 8 test cases
- [ ] Fix bugs nếu có
- [ ] Optimize performance
- [ ] Update documentation
- [ ] Final commit

### Post-deployment Checklist
- [ ] Monitor production logs
- [ ] Gather user feedback
- [ ] Fix any reported issues
- [ ] Update this document với lessons learned

---

## 9. KẾT LUẬN

### 9.1 Tóm tắt vấn đề

Module quản lý thành viên project gặp nhiều vấn đề nghiêm trọng:
1. Schema không đồng bộ (column name mismatch)
2. RLS infinite recursion
3. Type mismatch (UUID vs INTEGER)
4. Logic phân tán, khó maintain
5. Error handling yếu

### 9.2 Giải pháp đề xuất

**Kiến trúc 3 lớp rõ ràng:**
- **Database Layer:** SECURITY DEFINER functions + Simple RLS
- **Service Layer:** Class-based service với error handling
- **Component Layer:** Clean UI component

**Nguyên tắc:**
- Single source of truth
- Separation of concerns
- Fail-safe design
- Type safety

### 9.3 Next Steps

Sau khi module này hoàn thành, có thể mở rộng:
1. **Email notifications** khi add/remove members
2. **Audit log** cho member actions
3. **Invitation system** (send email invite)
4. **Bulk operations** (add/remove nhiều members)
5. **Advanced permissions** (custom permissions per member)

---

**📝 Tài liệu này sẽ được update liên tục trong quá trình thực hiện.**
