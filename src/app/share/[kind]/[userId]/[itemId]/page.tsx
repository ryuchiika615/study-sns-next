import { getShareCardData } from "@/lib/share-data";
import { appUrl } from "@/lib/share";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: { kind: string; userId: string; itemId: string }; searchParams: { ref?: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getShareCardData(params.kind, params.userId, params.itemId);
  if (!data) return { title: "リュッター" };
  const path = `/share/${params.kind}/${params.userId}/${params.itemId}`;
  return { title: `${data.title} | リュッター`, description: `${data.subtitle} — ${data.metric}`, openGraph: { title: data.title, description: `${data.subtitle} — ${data.metric}`, images: [{ url: `${appUrl(path)}/opengraph-image` }] }, twitter: { card: "summary_large_image", title: data.title, description: `${data.subtitle} — ${data.metric}` } };
}

export default async function SharePage({ params, searchParams }: Props) {
  const data = await getShareCardData(params.kind, params.userId, params.itemId);
  if (!data) notFound();
  const referral = searchParams.ref ? `/r/${encodeURIComponent(searchParams.ref)}` : "/auth/signup";
  return <main className="min-h-screen bg-slate-950 flex items-center justify-center p-5 text-white"><section className="w-full max-w-md rounded-3xl bg-gradient-to-br from-blue-900 to-slate-900 p-7 shadow-2xl border border-blue-400/30"><p className="text-blue-200 text-sm font-bold tracking-widest">LYUTTER STUDY CARD</p><h1 className="text-3xl font-bold mt-8">{data.title}</h1><p className="text-blue-100 mt-2">{data.subtitle}</p><p className="text-5xl font-black mt-10">{data.metric}</p><p className="text-orange-300 font-bold mt-3">{data.label}</p><div className="mt-10 border-t border-white/20 pt-5 flex justify-between items-center"><span className="font-bold">リュッター</span><Link href={referral} className="bg-white text-blue-900 px-4 py-2 rounded-full text-sm font-bold no-underline">一緒に記録する</Link></div></section></main>;
}
