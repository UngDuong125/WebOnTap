'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '../../lib/api';

type LeaderboardRow = {
  id: string;
  username: string;
  total_exp: number;
  math_exp: number;
  lang_exp: number;
  flang_exp: number;
  sci_exp: number;
  hist_geo_exp: number;
  civic_exp: number;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      const response = await fetch(apiUrl('/api/leaderboard'));
      if (response.ok) {
        const data = await response.json();
        setRows(data);
      }
      setLoading(false);
    }

    void fetchLeaderboard();
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10 text-slate-100">
      <div className="mb-8 rounded-3xl border border-slate-700 bg-slate-900/90 p-8 shadow-2xl shadow-slate-950/40">
        <h1 className="text-3xl font-semibold">Bảng xếp hạng</h1>
        <p className="mt-3 text-slate-400">Xếp hạng người dùng theo tổng điểm EXP toàn hệ thống.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <a href="/" className="rounded-full border border-slate-600 px-4 py-2 hover:border-cyan-400">Trang chủ</a>
          <a href="/dashboard" className="rounded-full border border-slate-600 px-4 py-2 hover:border-cyan-400">Dashboard</a>
          <a href="/admin" className="rounded-full border border-slate-600 px-4 py-2 hover:border-cyan-400">Admin</a>
        </div>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-slate-700 bg-slate-900/90 p-4 shadow-xl shadow-slate-950/30">
        {loading ? (
          <p className="text-slate-300">Đang tải bảng xếp hạng...</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-300">Chưa có dữ liệu xếp hạng.</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-700 text-left text-sm text-slate-200">
            <thead>
              <tr>
                <th className="px-4 py-3">Hạng</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Tổng EXP</th>
                <th className="px-4 py-3">Toán</th>
                <th className="px-4 py-3">Ngôn ngữ</th>
                <th className="px-4 py-3">Ngoại ngữ</th>
                <th className="px-4 py-3">Khoa học</th>
                <th className="px-4 py-3">Lịch sử & Địa lý</th>
                <th className="px-4 py-3">GDCD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? 'bg-slate-950/60' : ''}>
                  <td className="px-4 py-4 font-semibold text-cyan-300">{index + 1}</td>
                  <td className="px-4 py-4">{row.username}</td>
                  <td className="px-4 py-4 font-semibold">{row.total_exp}</td>
                  <td className="px-4 py-4">{row.math_exp}</td>
                  <td className="px-4 py-4">{row.lang_exp}</td>
                  <td className="px-4 py-4">{row.flang_exp}</td>
                  <td className="px-4 py-4">{row.sci_exp}</td>
                  <td className="px-4 py-4">{row.hist_geo_exp}</td>
                  <td className="px-4 py-4">{row.civic_exp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
