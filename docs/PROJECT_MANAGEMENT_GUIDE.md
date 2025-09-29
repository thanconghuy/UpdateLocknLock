# 🏢 Hướng Dẫn Quản Trị Projects

## 📋 Tổng Quan

Module Quản Trị Projects cho phép bạn:
- ✏️ **Chỉnh sửa** thông tin project
- 🔄 **Cập nhật** cấu hình WooCommerce
- 🗑️ **Xóa** project (có kiểm tra an toàn)
- 🧪 **Test** kết nối WooCommerce
- 🔒 **Phân quyền** người dùng

## 🚀 Cách Truy Cập

### 1. Từ Navigation Bar
Nhấn button **🏢 Projects** trên thanh navigation chính

### 2. Từ Project Dropdown
- Nhấn vào tên project hiện tại
- Chọn **⚙️ Quản lý Projects**

## 🛠️ Chức Năng Chính

### ✏️ **Chỉnh Sửa Project**

1. **Nhấn nút "✏️ Sửa"** trên project card
2. **Form chỉnh sửa sẽ hiện ra** với các trường:
   - **Tên Project*** (bắt buộc, 2-100 ký tự)
   - **Mô tả** (tùy chọn, tối đa 500 ký tự)
   - **Trạng thái** (Hoạt động/Tạm dừng)
   - **WooCommerce URL*** (phải là URL hợp lệ)
   - **Consumer Key*** (phải bắt đầu với `ck_`)
   - **Consumer Secret*** (phải bắt đầu với `cs_`)
   - **Products Table** (tên bảng chứa sản phẩm)

3. **Nhấn "💾 Lưu"** để áp dụng thay đổi
4. **Hệ thống sẽ tự động**:
   - Validate dữ liệu đầu vào
   - Test kết nối WooCommerce (nếu thay đổi credentials)
   - Cập nhật database
   - Reload danh sách projects

### 🗑️ **Xóa Project**

1. **Nhấn nút "🗑️ Xóa"** trên project card
2. **Hộp thoại xác nhận** sẽ hiện ra
3. **Nhấn "🗑️ Xóa"** để xác nhận
4. **Hệ thống sẽ**:
   - Kiểm tra quyền xóa (chỉ owner hoặc admin)
   - Thực hiện soft delete (đánh dấu `is_active = false`)
   - Tự động chuyển sang project khác (nếu có)

## 🔒 Phân Quyền

### **👤 Người Dùng Thường**
- ❌ Không thể truy cập module này
- ⚠️ Cần ít nhất quyền project member

### **📝 Project Member/Editor**
- ✅ Xem danh sách projects
- ❌ Không thể sửa/xóa

### **👨‍💼 Project Manager**
- ✅ Xem danh sách projects
- ✅ Chỉnh sửa project information
- ❌ Không thể xóa project

### **👑 Project Owner**
- ✅ Toàn quyền trên project của mình
- ✅ Chỉnh sửa mọi thông tin
- ✅ Xóa project

### **🔑 System Admin**
- ✅ Toàn quyền trên tất cả projects
- ✅ Chỉnh sửa/xóa bất kỳ project nào
- ✅ Hard delete projects (nếu cần)

## 🛡️ Tính Năng Bảo Mật

### **Validation Dữ Liệu**
- ✅ Kiểm tra độ dài tên project
- ✅ Validate URL WooCommerce
- ✅ Kiểm tra định dạng Consumer Key/Secret
- ✅ Validate tên bảng database

### **Kiểm Tra Quyền Hạn**
- ✅ Xác thực user trước mọi thao tác
- ✅ Kiểm tra quyền sửa/xóa project
- ✅ Prevent unauthorized access

### **Safety Checks**
- ✅ Confirmation dialog cho delete
- ✅ Soft delete by default (có thể restore)
- ✅ Auto-switch project sau khi xóa
- ✅ WooCommerce connection test trước khi lưu

## 🧪 Test Kết Nối WooCommerce

Khi bạn thay đổi thông tin WooCommerce, hệ thống sẽ:

1. **Tự động test connection** với credentials mới
2. **Hiển thị warning** nếu kết nối thất bại
3. **Vẫn cho phép lưu** (để không block workflow)
4. **Log chi tiết** trong console để debug

## 📱 Responsive Design

- ✅ **Desktop**: Layout 2 cột với form bên phải
- ✅ **Tablet**: Layout responsive
- ✅ **Mobile**: Single column, optimized touch targets

## 🐛 Troubleshooting

### **Lỗi "Permission Denied"**
- Kiểm tra role user trong database
- Đảm bảo user là owner/manager của project

### **Lỗi "WooCommerce Connection Failed"**
- Kiểm tra URL WooCommerce
- Verify Consumer Key/Secret
- Kiểm tra firewall/CORS settings

### **Lỗi "Validation Failed"**
- Kiểm tra độ dài tên project
- Đảm bảo URL là valid format
- Consumer Key phải bắt đầu với `ck_`
- Consumer Secret phải bắt đầu với `cs_`

### **Project Không Hiển Thị**
- Kiểm tra `is_active = true` trong database
- Verify user có trong project_members table
- Check RLS policies trong Supabase

## 🚀 Best Practices

1. **Luôn backup** trước khi xóa project
2. **Test WooCommerce connection** sau khi cập nhật credentials
3. **Sử dụng descriptive names** cho projects
4. **Phân quyền user** đúng role
5. **Monitor logs** để debug issues

## 📊 Database Schema

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  slug VARCHAR(100) UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  manager_id UUID REFERENCES auth.users(id),

  -- WooCommerce config
  woocommerce_base_url TEXT NOT NULL,
  woocommerce_consumer_key TEXT NOT NULL,
  woocommerce_consumer_secret TEXT NOT NULL,

  -- Database config
  products_table VARCHAR(50) DEFAULT 'products',
  audit_table VARCHAR(50) DEFAULT 'product_updates',

  -- Settings
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  max_members INTEGER DEFAULT 10,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

🎉 **Module Quản Trị Projects đã sẵn sàng sử dụng!**

Để hỗ trợ hoặc báo cáo bug, vui lòng liên hệ admin hoặc tạo issue trong repository.