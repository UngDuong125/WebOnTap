# Quiz Master

Ung dung Next.js + Tailwind CSS cho he thong quiz do admin bien soan, quan ly EXP theo tag va bang xep hang.

## Tính năng chính

- Đăng nhập bằng `username` (chỉ người dùng đã tồn tại mới đăng nhập được).
- Admin tao de tu du lieu raw text theo dinh dang cot `|`.
- Admin co the phan phoi de cho tat ca hoac nhieu user muc tieu.
- Lưu `high_score` và cộng EXP theo mức vượt kỷ lục.
- Bảng xếp hạng người dùng theo tổng EXP.
- Admin panel quan ly publish bo de cho user.

## Cài đặt

1. Sao chép tệp `.env.example` sang `.env`.
2. Dien gia tri Supabase va Cloudinary neu can upload anh.
3. Cài đặt gói:

```bash
npm install
```

4. Chạy ứng dụng:

```bash
npm run dev
```

## Yêu cầu Supabase

Tạo 2 bảng theo `supabase/schema.sql`:
- `users`
- `quizzes`

## Ghi chu

- User chi duoc lam cac bo de da `is_published = true`.
- Admin tao de trong trang `/admin`, kiem tra va nhan publish.
