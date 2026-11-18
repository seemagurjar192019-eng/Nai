import Link from 'next/link';
import { BookOpen, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#F6F8F7] dark:bg-[#0D1210] flex items-center justify-center p-5">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 text-center shadow-lg space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#008037]/10 text-[#008037] dark:text-emerald-400">
          <BookOpen className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">404</p>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Page Not Found
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            Yeh page available nahi hai. Apne BolBahi Khata par wapas jaayein.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#008037] hover:bg-[#006B2E] px-5 py-3.5 text-sm font-bold text-white transition"
        >
          <Home className="h-4 w-4" />
          Back to BolBahi Khata
        </Link>
      </div>
    </main>
  );
}
