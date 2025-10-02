# Hướng Dẫn Quản Lý Thành Viên Dự Án (Project Members Management)

## Tổng Quan

Module Quản Lý Thành Viên Dự Án cho phép quản trị viên và người quản lý dự án thêm, xóa và phân quyền các thành viên trong từng dự án. Module này được xây dựng lại hoàn toàn với kiến trúc 4 cấp độ vai trò rõ ràng.

## Hệ Thống 4 Cấp Độ Vai Trò

### 1. Admin (Quản trị viên) - Level 100
**Quyền hạn:**
- Thấy tất cả người dùng trong hệ thống
- Có thể phân quyền tất cả các vai trò (Admin, Manager, Editor, Viewer)
- Quản lý toàn bộ thành viên trong mọi dự án
- Truy cập tất cả các chức năng của hệ thống

**Chức năng:**
- Thêm/xóa thành viên
- Phân quyền bất kỳ vai trò nào
- Xem danh sách tất cả thành viên
- Quản lý cài đặt dự án

### 2. Manager (Quản lý) - Level 80
**Quyền hạn:**
- Thấy người dùng có vai trò: Manager, Editor, Viewer (KHÔNG thấy Admin)
- Có thể phân quyền các vai trò: Manager, Editor, Viewer (KHÔNG thể phân Admin)
- Quản lý thành viên trong dự án được phân quyền
- Truy cập các chức năng quản lý dự án

**Chức năng:**
- Thêm/xóa thành viên (trừ Admin)
- Phân quyền Manager, Editor, Viewer
- Xem danh sách thành viên
- Quản lý sản phẩm và các module khác

### 3. Editor (Biên tập viên) - Level 60
**Quyền hạn:**
- Chỉ xem được dự án được phân quyền
- Thao tác các chức năng trong trang Products
- KHÔNG được thêm/xóa thành viên
- KHÔNG thấy nút "👥 Thành viên"

**Chức năng:**
- Xem và chỉnh sửa sản phẩm
- Thao tác dữ liệu trong dự án
- Không có quyền quản lý thành viên

### 4. Viewer (Người xem) - Level 40
**Quyền hạn:**
- Chỉ xem được dự án được phân quyền
- CHỈ xem, KHÔNG được chỉnh sửa
- KHÔNG được thêm/xóa thành viên
- KHÔNG thấy nút "👥 Thành viên"

**Chức năng:**
- Xem sản phẩm (read-only)
- Không có quyền chỉnh sửa hoặc quản lý

## Ma Trận Quyền Hạn

| Chức năng | Admin | Manager | Editor | Viewer |
|-----------|-------|---------|--------|--------|
| Thấy Admin users | ✅ | ❌ | ❌ | ❌ |
| Thấy Manager users | ✅ | ✅ | ❌ | ❌ |
| Thấy Editor users | ✅ | ✅ | ✅ | ❌ |
| Thấy Viewer users | ✅ | ✅ | ✅ | ✅ |
| Phân quyền Admin | ✅ | ❌ | ❌ | ❌ |
| Phân quyền Manager | ✅ | ✅ | ❌ | ❌ |
| Phân quyền Editor | ✅ | ✅ | ❌ | ❌ |
| Phân quyền Viewer | ✅ | ✅ | ❌ | ❌ |
| Thêm thành viên | ✅ | ✅ | ❌ | ❌ |
| Xóa thành viên | ✅ | ✅ | ❌ | ❌ |
| Nút "👥 Thành viên" | ✅ | ✅ | ❌ | ❌ |
| Chỉnh sửa sản phẩm | ✅ | ✅ | ✅ | ❌ |
| Xem sản phẩm | ✅ | ✅ | ✅ | ✅ |

## Hướng Dẫn Sử Dụng

### 1. Thêm Thành Viên Vào Dự Án

**Bước 1:** Đăng nhập với tài khoản Admin hoặc Manager

**Bước 2:** Chọn dự án cần quản lý thành viên

**Bước 3:** Click nút "👥 Thành viên" (chỉ hiện với Admin/Manager)

**Bước 4:** Click nút "➕ Thêm thành viên"

**Bước 5:** Chọn người dùng từ dropdown
- Admin: Thấy tất cả người dùng
- Manager: Chỉ thấy Manager, Editor, Viewer

**Bước 6:** Chọn vai trò cho thành viên
- Admin: Có thể chọn tất cả vai trò
- Manager: Chỉ có thể chọn Manager, Editor, Viewer

**Bước 7:** Click "Lưu"

### 2. Xóa Thành Viên Khỏi Dự Án

**Bước 1:** Mở modal "Quản lý thành viên"

**Bước 2:** Tìm thành viên cần xóa trong danh sách

**Bước 3:** Click nút "Xóa" bên cạnh tên thành viên

**Bước 4:** Xác nhận xóa

**Lưu ý:** Thành viên bị xóa sẽ có `status = 'removed'` trong database (soft delete)

### 3. Thay Đổi Vai Trò Thành Viên

**Bước 1:** Mở modal "Quản lý thành viên"

**Bước 2:** Tìm thành viên cần thay đổi vai trò

**Bước 3:** Click vào dropdown vai trò hiện tại

**Bước 4:** Chọn vai trò mới (theo quyền hạn của bạn)

**Bước 5:** Thay đổi được lưu tự động

### 4. Thêm Lại Thành Viên Đã Xóa

Nếu thêm lại thành viên đã bị xóa (status = 'removed'):
- Hệ thống tự động RESTORE thành viên đó
- Không báo lỗi duplicate
- Cập nhật vai trò mới và đổi status thành 'active'

## Kiến Trúc Kỹ Thuật

### Database Schema

**Bảng: project_members**
```sql
- id: UUID (Primary Key)
- project_id: INTEGER (Foreign Key to projects.project_id)
- user_id: UUID (Foreign Key to users.id)
- role: TEXT (admin/manager/editor/viewer)
- status: TEXT (active/removed/suspended)
- permissions: JSONB (custom permissions)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
- UNIQUE (project_id, user_id)
```

**Bảng: project_roles**
```sql
- id: UUID (Primary Key)
- name: TEXT (admin/manager/editor/viewer)
- level: INTEGER (100/80/60/40)
- display_name: TEXT
- description: TEXT
- permissions: JSONB
```

### Security Functions (SECURITY DEFINER)

Module sử dụng 5 functions PostgreSQL để quản lý quyền:

1. **get_available_users_for_project(p_project_id)**
   - Lấy danh sách users có thể thêm vào project
   - Lọc theo level của người dùng hiện tại
   - Admin thấy all, Manager không thấy Admin

2. **add_project_member(p_project_id, p_user_id, p_role, p_custom_permissions)**
   - Thêm thành viên mới vào project
   - Tự động restore nếu đã bị removed
   - Kiểm tra quyền: chỉ Admin/Manager được thêm

3. **remove_project_member(p_project_id, p_user_id)**
   - Xóa thành viên (soft delete: status = 'removed')
   - Kiểm tra quyền: chỉ Admin/Manager được xóa

4. **update_project_member_role(p_project_id, p_user_id, p_new_role)**
   - Cập nhật vai trò của thành viên
   - Kiểm tra quyền: chỉ Admin/Manager được update

5. **get_project_members(p_project_id)**
   - Lấy danh sách thành viên trong project
   - Chỉ trả về thành viên có status = 'active'

### Row Level Security (RLS)

**Policy: admin_all_access**
- Admin có full access (SELECT, INSERT, UPDATE, DELETE)

**Policy: users_view_own_memberships**
- User có thể SELECT records của chính mình (user_id = auth.uid())

### Service Layer

**File: src/services/projectMemberService.ts**
- Class-based service với error handling
- Methods: getMembers, addMember, removeMember, updateMemberRole
- Gọi các SECURITY DEFINER functions

**File: src/services/projectService.ts**
- 2-step query để load projects:
  1. Get project_ids từ project_members
  2. Get projects by project_ids
- Tránh dùng JOIN do Supabase relationship không hoạt động tốt với INTEGER FK

### UI Components

**File: src/components/project/ProjectManagement.tsx**
- Hiển thị danh sách projects
- Nút "👥 Thành viên" chỉ hiện cho Admin/Manager
- Helper: `canManageMembers(project)` kiểm tra quyền

**File: src/components/project/ProjectMembersModal.tsx**
- Modal quản lý thành viên
- Filter users theo permission: `filterUsersByPermission()`
- Filter roles theo permission: `filterRolesByPermission()`
- Real-time updates khi thêm/xóa/update

## Lỗi Thường Gặp và Cách Xử Lý

### 1. "Authentication timeout"
**Nguyên nhân:** Cache conflict với getSession()
**Giải pháp:** Đã fix bằng cách dùng getUser() thay vì getSession()

### 2. "Ambiguous column project_id"
**Nguyên nhân:** Bảng projects có cả id (UUID) và project_id (INTEGER)
**Giải pháp:** Dùng table alias (p., pm.) trong queries

### 3. "Duplicate key constraint"
**Nguyên nhân:** Thêm lại user đã bị removed
**Giải pháp:** Function tự động restore thay vì báo lỗi

### 4. User không thấy projects sau khi được thêm
**Nguyên nhân:** RLS policy chặn SELECT
**Giải pháp:** Thêm policy `users_view_own_memberships`

### 5. Manager thấy Admin users
**Nguyên nhân:** Function không filter theo role level
**Giải pháp:** Thêm filter trong `get_available_users_for_project`

## Testing Checklist

- [ ] Admin login và thấy tất cả users
- [ ] Admin có thể phân quyền tất cả roles (Admin, Manager, Editor, Viewer)
- [ ] Manager login và KHÔNG thấy Admin users
- [ ] Manager KHÔNG thấy Admin role trong dropdown
- [ ] Manager có thể thêm Manager, Editor, Viewer
- [ ] Editor login và KHÔNG thấy nút "👥 Thành viên"
- [ ] Viewer login và KHÔNG thấy nút "👥 Thành viên"
- [ ] Thêm lại user đã removed → auto restore thành công
- [ ] User được thêm vào project → login và thấy project
- [ ] Xóa user khỏi project → user không thấy project nữa

## Migration Guide

### Nếu Cài Đặt Mới

**Bước 1:** Chạy migrations trong thư mục `migrations/`
```bash
# Chạy theo thứ tự:
1. create_project_roles.sql
2. create_project_members.sql
3. create_project_member_functions.sql
4. fix_all_ambiguous_project_id.sql
5. fix_add_member_with_restore.sql
6. fix_project_members_rls_policy.sql
7. fix_permission_logic_final.sql
```

**Bước 2:** Verify database
```sql
-- Kiểm tra 4 roles đã có trong project_roles
SELECT * FROM project_roles ORDER BY level DESC;

-- Kiểm tra functions đã tạo
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%project_member%';

-- Kiểm tra RLS policies
SELECT * FROM pg_policies WHERE tablename = 'project_members';
```

**Bước 3:** Deploy frontend code

### Nếu Migrate Từ Module Cũ

**Lưu ý:** Module mới được xây dựng hoàn toàn riêng biệt, không ảnh hưởng code cũ.

**Option 1: Giữ song song**
- Module cũ và mới có thể chạy song song
- Dần migrate dữ liệu sang module mới

**Option 2: Migration toàn bộ**
- Backup dữ liệu project_members cũ
- Chạy migration scripts
- Verify data integrity

## File Structure

```
src/
├── components/
│   └── project/
│       ├── ProjectManagement.tsx          # Danh sách projects + nút Members
│       └── ProjectMembersModal.tsx        # Modal quản lý thành viên
├── services/
│   ├── projectService.ts                  # Load projects logic
│   └── projectMemberService.ts            # CRUD operations cho members
├── types/
│   ├── project.ts                         # Project interface + user_role
│   ├── projectRoles.ts                    # Role definitions + mappings
│   └── userManagement.ts                  # User interfaces
└── contexts/
    ├── AuthContext.tsx                    # User authentication + profile
    └── ProjectContext.tsx                 # Project state management

migrations/
├── create_project_roles.sql               # Tạo bảng project_roles
├── create_project_members.sql             # Tạo bảng project_members
├── create_project_member_functions.sql    # Tạo 5 functions
├── fix_all_ambiguous_project_id.sql       # Fix ambiguous column
├── fix_add_member_with_restore.sql        # Auto-restore logic
├── fix_project_members_rls_policy.sql     # RLS policies
└── fix_permission_logic_final.sql         # Permission filtering
```

## Best Practices

### 1. Luôn sử dụng SECURITY DEFINER functions
- Không query trực tiếp từ frontend
- Functions kiểm tra quyền tự động
- Bảo mật tốt hơn với RLS

### 2. Soft Delete thay vì Hard Delete
- `status = 'removed'` thay vì DELETE
- Giữ lịch sử thành viên
- Có thể restore dễ dàng

### 3. Filter ở cả Frontend và Backend
- Frontend: UX tốt hơn, phản hồi nhanh
- Backend: Bảo mật chắc chắn
- Defense in depth

### 4. Sử dụng 2-step query cho relationships
- Tránh JOIN phức tạp với Supabase
- Dễ debug hơn
- Performance tốt hơn với INTEGER FK

## Support

Nếu gặp vấn đề:
1. Kiểm tra console browser để xem error logs
2. Verify RLS policies trong Supabase dashboard
3. Kiểm tra functions có SECURITY DEFINER
4. Verify user role trong database

## Version History

**v2.0.0 (Current)** - Module hoàn toàn mới
- 4-tier role system (Admin, Manager, Editor, Viewer)
- SECURITY DEFINER functions
- Permission-based filtering
- Auto-restore removed members
- 2-step query pattern

**v1.0.0** - Module cũ (deprecated)
- 5 roles (owner, admin, editor, reviewer, viewer)
- Direct queries
- Nhiều bugs với permissions
