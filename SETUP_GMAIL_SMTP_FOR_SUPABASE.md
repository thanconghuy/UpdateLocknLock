# Hướng Dẫn Setup Gmail SMTP cho Supabase

## Phương án 1: Gmail SMTP (Khuyên dùng - Miễn phí & Dễ setup)

### Bước 1: Tạo Gmail App Password

1. **Đăng nhập Gmail** của bạn (tài khoản nào cũng được)

2. **Vào Google Account Settings:**
   - Truy cập: https://myaccount.google.com/
   - Hoặc click vào Avatar → "Manage your Google Account"

3. **Bật 2-Step Verification** (nếu chưa bật):
   - Click tab **Security** (Bảo mật)
   - Tìm "2-Step Verification" (Xác minh 2 bước)
   - Click **Turn on** → Làm theo hướng dẫn
   - **Lưu ý:** PHẢI bật 2FA mới tạo được App Password!

4. **Tạo App Password:**
   - Vẫn ở tab **Security**
   - Kéo xuống phần "Signing in to Google"
   - Click **App passwords** (Mật khẩu ứng dụng)
   - Nếu không thấy, search "App passwords" hoặc vào trực tiếp: https://myaccount.google.com/apppasswords
   - Chọn:
     - App: **Mail**
     - Device: **Other** → Nhập tên: "Supabase"
   - Click **Generate**
   - **SAO CHÉP** mật khẩu 16 ký tự (dạng: xxxx xxxx xxxx xxxx)
   - **LƯU LẠI** mật khẩu này, bạn sẽ cần dùng ở bước sau!

### Bước 2: Cấu hình SMTP trong Supabase

1. **Vào Supabase Dashboard:**
   - Click icon **⚙️ Settings** (góc dưới bên trái)
   - Chọn **Authentication**

2. **Kéo xuống phần SMTP Settings:**
   - Click **Enable Custom SMTP** (bật toggle)

3. **Điền thông tin Gmail SMTP:**

```
Sender email: your-email@gmail.com
Sender name: Tên hiển thị (ví dụ: "WP Product Management")

Host: smtp.gmail.com
Port number: 587
Minimum interval between emails: 1 (hoặc để mặc định)

Username: your-email@gmail.com
Password: [Dán App Password 16 ký tự vừa tạo - KHÔNG dùng mật khẩu Gmail thường]
```

**Thông số quan trọng:**
- ✅ Host: `smtp.gmail.com`
- ✅ Port: `587` (TLS/STARTTLS)
- ✅ Username: Email Gmail đầy đủ
- ✅ Password: App Password 16 ký tự (KHÔNG phải password Gmail)

4. **Click Save**

### Bước 3: Test SMTP

1. **Vào Authentication → Users**
2. Click vào một user
3. Click "..." → **Send Password Recovery**
4. Nếu thành công → Check email có nhận được không
5. Nếu lỗi → Xem error message, chụp màn hình

### Bước 4: Test Reset Password từ App

1. Refresh trang login: http://localhost:5173
2. Click "Quên mật khẩu?"
3. Nhập email
4. **KHÔNG còn lỗi 500 nữa!**
5. Check email → Click link → Đổi mật khẩu

---

## Phương án 2: SendGrid (Chuyên nghiệp hơn - Miễn phí 100 emails/ngày)

### Bước 1: Tạo SendGrid Account

1. Truy cập: https://sendgrid.com/
2. Click **Start for free**
3. Đăng ký tài khoản (miễn phí)
4. Verify email

### Bước 2: Tạo API Key

1. Vào SendGrid Dashboard
2. Settings → **API Keys**
3. Click **Create API Key**
4. Name: "Supabase SMTP"
5. Permissions: **Full Access**
6. Click **Create & View**
7. **COPY API Key** (chỉ hiện 1 lần!)

### Bước 3: Cấu hình trong Supabase

```
Sender email: your-verified-email@domain.com
Sender name: "WP Product Management"

Host: smtp.sendgrid.net
Port number: 587

Username: apikey
Password: [Dán SendGrid API Key]
```

**Lưu ý:** Username PHẢI là chữ `apikey` (không phải email!)

### Bước 4: Verify Sender Email

SendGrid yêu cầu verify email trước khi gửi:

1. Settings → **Sender Authentication**
2. Verify Single Sender
3. Nhập email → Verify

---

## Phương án 3: Resend (Modern, Developer-friendly)

### Setup Resend (Miễn phí 100 emails/ngày)

1. Truy cập: https://resend.com/
2. Sign up (có thể dùng GitHub)
3. Tạo API Key
4. Cấu hình trong Supabase:

```
Host: smtp.resend.com
Port: 587
Username: resend
Password: [Resend API Key]
```

---

## So sánh các phương án:

| Phương án | Ưu điểm | Nhược điểm | Khuyên dùng |
|-----------|---------|------------|-------------|
| **Gmail** | Miễn phí, dễ setup, không giới hạn | Bị giới hạn 500 emails/ngày, dễ bị spam | ✅ Test & Nhỏ |
| **SendGrid** | Chuyên nghiệp, deliverability tốt | Phải verify domain cho production | ⭐ Production |
| **Resend** | Modern, developer-friendly, dễ dùng | Mới, ít tính năng hơn | 🎯 Startup |

---

## Khắc phục lỗi thường gặp:

### Lỗi: "Invalid login credentials"
- ✅ Check Username phải là email đầy đủ
- ✅ Password phải là App Password (16 ký tự), không phải password Gmail
- ✅ Đã bật 2FA cho Gmail chưa?

### Lỗi: "Could not establish connection"
- ✅ Port phải là 587 (không phải 465 hay 25)
- ✅ Host: smtp.gmail.com (không có https://)
- ✅ Check firewall/network

### Lỗi: "Sender address rejected"
- ✅ Sender email phải trùng với Gmail account
- ✅ SendGrid: Phải verify sender email

### Email vào Spam
- ✅ Cấu hình SPF/DKIM records (nâng cao)
- ✅ Dùng SendGrid/Resend thay vì Gmail
- ✅ Customize email content

---

## Sau khi setup xong:

1. ✅ Save SMTP settings trong Supabase
2. ✅ Test gửi email từ Dashboard (Users → Send Password Recovery)
3. ✅ Test reset password từ app
4. ✅ Check email có nhận được không
5. ✅ Click link trong email
6. ✅ Test đổi mật khẩu
7. ✅ Login với mật khẩu mới

---

## Tips bảo mật:

1. **KHÔNG share App Password** với ai
2. **Tạo Gmail riêng** cho app (đừng dùng Gmail cá nhân)
3. **Revoke App Password** khi không dùng nữa
4. **Dùng SendGrid** cho production (tránh bị Gmail block)
5. **Monitor email logs** trong Supabase

---

## Nếu vẫn gặp lỗi:

Hãy chụp màn hình:
1. SMTP Settings sau khi save
2. Error message khi test send email
3. Auth Logs trong Supabase

Và gửi cho tôi để debug! 😊
