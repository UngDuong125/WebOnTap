# Quiz Master

Hệ thống đã được tách thành **2 app chạy độc lập**:

- `frontend/`: Next.js (UI) - chạy mặc định ở `http://localhost:3000`
- `backend/`: Express API - chạy mặc định ở `http://localhost:4000`

## Chạy từng app

1. Cài dependencies cho từng app:

```bash
npm install --prefix frontend
npm install --prefix backend
```

2. Tạo môi trường:

- `backend/.env` từ `backend/.env.example`
- `frontend/.env.local` với:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

3. Chạy backend:

```bash
npm run dev:backend
```

4. Chạy frontend:

```bash
npm run dev:frontend
```

## API chính (backend)

- `POST /api/auth/login`
- `GET, PATCH /api/quizzes`
- `GET, POST, PATCH, DELETE /api/admin/quizzes`
- `GET, PATCH, DELETE /api/admin/users`
- `GET /api/leaderboard`
- `POST /api/upload`

## Yêu cầu Supabase

Tạo bảng theo `supabase/schema.sql`:
- `users`
- `quizzes`
