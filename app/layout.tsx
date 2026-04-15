import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Quiz Master',
  description: 'He thong on thi trac nghiem do admin bien soan va phan phoi.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
