import type { ReactNode } from "react";
import Link from "next/link";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm font-black tracking-widest text-amber-400 no-underline">RYUTTER</Link>
        <article className="mt-5 rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-xl sm:p-8">
          <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
          <p className="mt-2 text-xs text-slate-400">最終更新日：{updated}</p>
          <div className="mt-7 space-y-7 text-sm leading-7 text-slate-200">{children}</div>
        </article>
        <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 py-6 text-xs text-slate-400">
          <Link href="/terms" className="underline">利用規約</Link>
          <Link href="/privacy" className="underline">プライバシーポリシー</Link>
          <Link href="/tokusho" className="underline">特定商取引法に基づく表記</Link>
        </nav>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="mb-2 text-base font-black text-white">{title}</h2><div>{children}</div></section>;
}
