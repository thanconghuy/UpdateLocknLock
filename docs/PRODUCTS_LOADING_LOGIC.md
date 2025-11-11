# Products Loading Logic - Tài liệu kỹ thuật

## Tổng quan

Module Products Page load danh sách sản phẩm theo **project isolation** và **user permissions**. Mỗi user chỉ thấy products của các projects họ được phân công.

## Flow Logic

### 1. Permission Check (ProductsPage.tsx)

**Bước 1: Verify User Access**
```typescript
// System admin → Access to ALL projects
if (userProfile.role === 'admin') {
  hasProjectAccess = true
}

// Non-admin → Check if project is in user's accessible projects list
const hasAccess = projects.some(p => p.id === currentProject.id)
```

**Logic:**
- ✅ **Admin users**: Có quyền xem tất cả projects (bypass permission check)
- ✅ **Non-admin users**: Chỉ thấy projects có trong danh sách `projects` từ `ProjectContext`
- ❌ **No access**: Hiển thị "Access Denied" và không load products

### 2. Project Loading (ProjectContext.tsx)

**Admin users:**
```typescript
// Load ALL projects (including deleted if includeDeleted=true)
query = supabase
  .from('projects')
  .select('*')
  .limit(50)
```

**Non-admin users:**
```typescript
// Step 1: Get project_ids from project_members
const { data: memberData } = await supabase
  .from('project_members')
  .select('project_id, role')
  .eq('user_id', user.id)
  .eq('status', 'active')

// Step 2: Get projects by project_ids
const projectIds = memberData.map(m => m.project_id)
query = supabase
  .from('projects')
  .select('*')
  .in('project_id', projectIds)
```

**Logic:**
- User chỉ thấy projects có trong `project_members` với `status = 'active'`
- Projects được filter theo `project_id` (INTEGER), không phải `id` (UUID)

### 3. Products Loading (ProductsPage.tsx)

**Query với Project Isolation:**
```typescript
const baseQuery = currentProject
  ? supabase
      .from('products_new')
      .select('*')
      .eq('project_id', currentProject.project_id)  // 🔑 Key filter
      .order('updated_at', { ascending: false })
  : supabase
      .from('products_new')
      .select('*')
      .order('updated_at', { ascending: false })
```

**Logic:**
- ✅ **Có currentProject**: Filter theo `project_id = currentProject.project_id`
- ⚠️ **Không có currentProject**: Load tất cả (fallback - không nên xảy ra)

### 4. Data Flow

```
User Login
  ↓
AuthContext: Load user profile
  ↓
ProjectContext: Load user's projects
  ├─ Admin → Load ALL projects
  └─ Non-admin → Load projects from project_members
  ↓
User selects project → currentProject set
  ↓
ProductsPage: Verify access
  ├─ Admin → ✅ Always granted
  └─ Non-admin → Check if project in projects list
  ↓
If access granted → Load products
  ↓
Query: SELECT * FROM products_new WHERE project_id = ?
```

## Security Layers

### Layer 1: Frontend Permission Check
- ✅ ProductsPage checks `hasProjectAccess` before loading
- ✅ Blocks UI if user doesn't have access

### Layer 2: Project Context Filtering
- ✅ `ProjectContext.loadProjects()` only loads accessible projects
- ✅ Non-admin users only see projects from `project_members` table

### Layer 3: Database Query Filter
- ✅ Products query always includes `.eq('project_id', currentProject.project_id)`
- ✅ Prevents cross-project data leakage

### Layer 4: RLS Policies (Recommended)
- ⚠️ **Currently missing**: No RLS policies on `products_new` table
- 💡 **Recommendation**: Add RLS to enforce at database level

## Potential Issues & Fixes

### Issue 1: User can see products if they manually set currentProject
**Status**: ✅ **FIXED**
- Added `hasProjectAccess` check before loading products
- UI blocks access if project not in user's accessible list

### Issue 2: No RLS on products_new table
**Status**: ⚠️ **RECOMMENDED FIX**
- Currently relies on frontend filtering only
- Should add RLS policies for defense-in-depth

### Issue 3: Project ID mismatch
**Status**: ✅ **CORRECT**
- Uses `currentProject.project_id` (INTEGER) for filtering
- Matches `products_new.project_id` column type

## Testing Checklist

- [ ] Admin user can see all projects and their products
- [ ] Non-admin user only sees assigned projects
- [ ] Non-admin user cannot access products of unassigned projects
- [ ] Products are correctly filtered by project_id
- [ ] Switching projects reloads correct products
- [ ] Access denied message shows when user lacks permission

## Database Schema Reference

```sql
-- Projects table
projects (
  id UUID PRIMARY KEY,
  project_id INTEGER UNIQUE,  -- Used for filtering
  name VARCHAR,
  owner_id UUID,
  ...
)

-- Project members table
project_members (
  id UUID PRIMARY KEY,
  project_id INTEGER REFERENCES projects(project_id),
  user_id UUID REFERENCES user_profiles(id),
  role VARCHAR,
  status VARCHAR,  -- 'active', 'removed', 'suspended'
  ...
)

-- Products table
products_new (
  id UUID PRIMARY KEY,
  project_id INTEGER,  -- Filter key
  website_id VARCHAR,
  title VARCHAR,
  ...
)
```

## Recommendations

1. **Add RLS Policies**: Create Row Level Security policies on `products_new` table
2. **Add Permission Service**: Use `ProjectMembersService` to check permissions (currently commented out)
3. **Add Audit Logging**: Log when users access products for security monitoring
4. **Add Rate Limiting**: Prevent abuse of product queries

