# CV Website

Trang web CV cá nhân chuyên nghiệp (HTML/CSS/JS thuần) với dark/light mode, responsive, tối ưu in ấn và có form liên hệ.

## Chế độ hoạt động
- Static Mode (GitHub Pages / mở trực tiếp index.html):
  - Nội dung động lấy từ `data/content.json`.
  - Đánh giá (reviews) chỉ lưu trong LocalStorage (không ghi vào file trên server).
  - Form liên hệ mở ứng dụng email (mailto) thay vì gửi qua backend.
- Server Mode (Node/Express):
  - API `/api/content`, `/api/reviews`, `/api/contact` hoạt động đầy đủ.
  - Lưu đánh giá vào `data/reviews.json` và chỉnh sửa nội dung qua admin.

## Cấu trúc
```
index.html
assets/
  css/style.css
  js/main.js
  img/avatar.png (thêm ảnh của bạn)
  cv.pdf (đặt file CV để nút download hoạt động)
 data/
  content.json (nội dung động)
  reviews.json (seed đánh giá ban đầu – static mode chỉ đọc)
```

## Sử dụng (chế độ tĩnh)
1. Chỉnh sửa nội dung trong `data/content.json` (xem mẫu bên trong).
2. Mở `index.html` trên trình duyệt hoặc deploy lên GitHub Pages.
3. Thêm ảnh avatar vào `assets/img/avatar.png` và CV vào `assets/cv.pdf`.

## Deploy GitHub Pages
1. Tạo repository và push toàn bộ code.
2. Vào Settings > Pages > chọn Source: `main` (root) > Save.
3. Chờ vài phút, truy cập: `https://<username>.github.io/<repo>/`.
4. Kiểm tra:
   - Contact form mở mail app.
   - Reviews lưu được tạm trong LocalStorage.
   - Nội dung hiển thị theo `data/content.json`.

## Chạy Server Mode (tùy chọn)
Cần Node.js:
```
npm install
npm start
```
Mặc định chạy ở `http://localhost:3000` với API.

## Tính năng
- Responsive, mobile-first.
- Dark / Light toggle (localStorage).
- Scroll spy active nav.
- Nút Back to Top.
- Form liên hệ validation phía client (+ mailto fallback).
- Đánh giá sao với lưu cục bộ (static) hoặc server.
- Dynamic content JSON.
- Prefetch CV PDF khi idle.
- Accessible (focus outlines, aria-labels, semantic HTML).

## Gợi ý nâng cấp
- Dùng dịch vụ Form (Formspree, Getform) thay cho mailto.
- Chuyển API sang serverless (Vercel / Netlify Functions).
- Thêm xác thực admin an toàn hơn.
- Tích hợp phân tích (Plausible / Umami).

## License
Bạn toàn quyền chỉnh sửa và sử dụng.
