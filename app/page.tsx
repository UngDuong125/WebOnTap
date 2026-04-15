import Link from 'next/link';


export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="rounded-3xl border border-slate-700 bg-slate-900/80 p-10 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <h1 className="text-4xl font-semibold text-white">Quiz Master</h1>
        <p className="mt-4 text-slate-300">
          Hệ thống ôn thi.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link href="/login" className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
            Đăng nhập
          </Link>
          <Link href="/dashboard" className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-500">
            Dashboard
          </Link>
          <Link href="/admin" className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-500">
            Admin
          </Link>
          <Link href="/leaderboard" className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:border-slate-500">
            Xem bảng xếp hạng
          </Link>
        </div>
      </div>
    </main>
  );
}
