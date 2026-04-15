'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.trim() }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json();
      setMessage(payload?.error ?? 'Đăng nhập thất bại.');
      return;
    }

    const user = await response.json();
    localStorage.setItem('ai-quiz-user', JSON.stringify(user));
    if (user.role === 'admin') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-20 text-white">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/95 p-10 shadow-xl shadow-slate-950/40">
        <h1 className="text-3xl font-semibold">Đăng nhập</h1>
        <p className="mt-3 text-slate-400">Nhập Username đã tồn tại để tiếp tục vào hệ thống.</p>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-300">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              minLength={3}
              className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              placeholder="Nhập username"
            />
          </label>
          {message ? <p className="text-sm text-rose-400">{message}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </main>
  );
}
