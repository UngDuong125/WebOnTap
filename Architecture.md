
---

# Tài liệu Kiến trúc Hệ thống: Quiz Master (Version 2.0 - Admin Driven)

Hệ thống ôn tập trắc nghiệm tập trung, nơi Admin đóng vai trò biên soạn nội dung chất lượng cao và phân phối tới người dùng thông qua hệ thống chỉ số năng lực.

---

## 1. Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ lựa chọn | Lý do |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 14+ (App Router)** | Quản lý trạng thái, Dashboard Admin và Giao diện làm bài mượt mà. |
| **Styling** | **Tailwind CSS** | Xây dựng trình chỉnh sửa câu hỏi (Editor) trực quan. |
| **Backend** | **Next.js API Routes** | Xử lý logic parse dữ liệu, tính điểm và kết nối Cloudinary/Supabase. |
| **Database** | **Supabase (PostgreSQL)** | Lưu trữ `jsonb` cho câu hỏi, quản lý Auth và Realtime Leaderboard. |
| **Image Storage** | **Cloudinary** | Lưu trữ ảnh câu hỏi chuyên nghiệp, hỗ trợ resize/tối ưu ảnh qua URL. |

---

## 2. Phân quyền & Luồng phân phối

* **Admin:** Quyền duy nhất được tạo đề, nhập câu hỏi hàng loạt, chỉnh sửa và đăng tải (Publish).
* **Người dùng:** Không có quyền tạo đề. Chỉ có thể xem và làm các bộ đề mà Admin đã đánh dấu là "Hoàn thành" (Available).
* **Phân phối:** Đề thi sau khi Admin nhấn "Hoàn thành" sẽ xuất hiện trên Dashboard của tất cả người dùng (hoặc theo nhóm mục tiêu).

---

## 3. Quy ước Định dạng Nhập liệu (Admin Question Bank)

Admin khi tạo đề mới sẽ đặt tên đề, gắn tag, chọn số lượng câu hỏi hiển thị khi user làm bài và nhập dữ liệu thô (Raw text) theo format phân tách bằng dấu gạch đứng `|` để hệ thống parse vào database.

**Format:**
`Loại | Danh mục | Có ảnh? (Y/N) | Câu hỏi | Đáp án (MCQ tách bằng ; hoặc text cho điền từ) | Đáp án đúng | Giải thích`

**Ví dụ:**
1. `MCQ | thucvat | N | Cỏ bốn lá có mấy lá? | 1; 2; 3; 4 | D | Kiến thức cơ bản`
2. `FILL | dongvat | Y | Con vật này tên gì? | (để trống) | Mèo | Đây là mèo`

---

## 4. Cấu trúc Database (Supabase)

### Table: `users`
- `id`: uuid (PK)
- `username`: text (Unique)
- `role`: text ('admin' hoặc 'user')
- `math_exp`, `sci_exp`,...: int (Lưu tổng điểm kinh nghiệm)

### Table: `quizzes`
- `id`: uuid (PK)
- `title`: text
- `tag`: text (Môn học)
- `is_published`: boolean (Default: `false`)
- `created_by`: uuid (FK to users)

### Table: `questions` (Sử dụng JSONB)
- `id`: uuid (PK)
- `quiz_id`: uuid (FK to quizzes)
- `content`: **jsonb**
    - Cấu trúc bên trong `content`:
      ```json
      {
        "type": "MCQ" | "FILL",
        "category": "Toán",
        "has_image": true,
        "image_url": "https://cloudinary...",
        "question_text": "...",
        "options": ["...", "...", "..."],
        "answer": "...",
        "explanation": "..."
      }
      ```

---

## 5. Luồng Dữ liệu Mới (The Admin Workflow)

### Bước 1: Nhập liệu & Parse
Admin dán bộ câu hỏi thô vào khu vực nhập liệu. Hệ thống sử dụng Regex hoặc `.split('|')` để tách các trường và chuyển thành mảng Object JSON.

### Bước 2: Màn hình Chỉnh sửa (Editor Mode)
Hệ thống hiển thị danh sách câu hỏi dưới dạng các Card.
- Admin có thể sửa text trực tiếp.
- Nếu câu hỏi đánh dấu `has_image: true`, hệ thống hiển thị nút **"Tải lên hình ảnh"**.
- Admin cũng có thể lựa chọn số câu hỏi trong danh mục của đề đó sẽ được xuất hiện trong đề ôn của user.

### Bước 3: Xử lý Hình ảnh (Cloudinary)
Khi Admin chọn ảnh:
1. Client gửi ảnh lên Cloudinary thông qua API.
2. Cloudinary trả về URL ảnh.
3. Hệ thống cập nhật trường `image_url` vào `jsonb` của câu hỏi đó trong DB.

### Bước 4: Hoàn thành & Đăng tải (Publish)
Admin kiểm tra lại toàn bộ đề. Sau khi nhấn **"Hoàn thành bộ đề"**:
1. Field `is_published` trong table `quizzes` chuyển thành `true`.
2. Bộ đề bắt đầu khả dụng cho người dùng cuối.

---

## 6. Lộ trình triển khai (Updated Roadmap)

- [ ] **Sprint 1:** Dựng UI Admin nhập liệu thô và bộ Parser text sang JSON.
- [ ] **Sprint 2:** Xây dựng màn hình Editor cho phép sửa câu hỏi và quản lý `jsonb`.
- [ ] **Sprint 3:** Tích hợp Cloudinary SDK để upload ảnh và lưu URL vào JSON.
- [ ] **Sprint 4:** Xây dựng logic "Publish" và màn hình Dashboard hiển thị đề cho người dùng.
- [ ] **Sprint 5:** Hệ thống tính điểm `high_score` và cập nhật EXP người dùng khi làm đề Admin.

---

### Một số lưu ý cho bạn khi code:
1.  **Next.js Client Component:** Màn hình Editor nên dùng `useOptimistic` hoặc quản lý state kỹ để khi sửa câu hỏi/up ảnh giao diện không bị giật.
2.  **Supabase JSONB:** Khi query hoặc update trường trong `jsonb`, hãy dùng cú pháp `->` hoặc `->>` của PostgreSQL (Supabase hỗ trợ qua `.update({ content: ... })`).
3.  **Cloudinary:** Bạn nên tạo một `unsigned upload preset` trên Cloudinary để có thể upload trực tiếp từ Frontend cho nhanh, hoặc viết một `API Route` để bảo mật `API_KEY`.

## 5. Luồng Hoạt Động Của User
- Sau khi đăng nhập, user có thể lựa chọn 1 bộ đề được phân phối cho mình để thực hiện.
- Khi hoàn thành bộ đề, người dùng có thể chọn làm lại và câu hỏi sẽ bị xáo trộn.

## 6. Hệ thống Người dùng & Quyền riêng tư

* **Đăng nhập tối giản:** Hệ thống sử dụng **Tên người dùng (Username)** để đăng nhập. 
    * Nếu Username chưa tồn tại: Không thể vào hệ thống.
    * Nếu đã tồn tại: Đăng nhập vào phiên làm việc cũ.
* **Phân tách dữ liệu:** Các bộ đề được lưu trữ gắn liền với `user_id`. Người dùng này không thể xem hoặc làm bộ đề của người dùng khác.

---

## 7. Hệ thống Chỉ số (Metrics) & Bảng xếp hạng

### 7.1. Các loại chỉ số kỹ năng
Người dùng sẽ tích lũy điểm kinh nghiệm (EXP) qua 6 nhóm lĩnh vực:
1.  **Toán học**
2.  **Ngôn ngữ** (Tiếng Việt/Văn học)
3.  **Ngoại ngữ**
4.  **Khoa học** (Lý, Hóa, Sinh)
5.  **Lịch sử & Địa lý**
6.  **Giáo dục công dân**

### 7.2. Thuật toán tính điểm (Progressive Scoring)
Điểm chỉ số chỉ được cộng dựa trên sự **vượt ngưỡng** của bản thân:
* Mỗi bộ đề lưu một biến `high_score` (điểm cao nhất từng đạt được).
* **Công thức:** `Điểm cộng thêm = Max(0, Điểm hiện tại - High Score cũ)`.
* Nếu làm bài thấp điểm hơn kỷ lục cũ: **Không bị trừ điểm** chỉ số.

### 7.3. Bảng xếp hạng (Leaderboard)
* Hiển thị danh sách Top người dùng có tổng điểm (hoặc điểm từng loại) cao nhất toàn hệ thống để tăng tính cạnh tranh.
