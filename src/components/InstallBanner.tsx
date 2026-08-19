"use client";

import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "other";

const NEW_USER_KEY = "ryutter_show_notification_setup";
const DISMISS_KEY = "install_banner_dismissed";

function detectPlatform(): Platform {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipod|ipad/.test(userAgent) || isIPad) return "ios";
  if (/android/.test(userAgent)) return "android";
  return "other";
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window.navigator as any).standalone || window.matchMedia("(display-mode: standalone)").matches) return;

    setPlatform(detectPlatform());
    const justSignedUp = sessionStorage.getItem(NEW_USER_KEY) === "1";
    let timer: number | undefined;
    if (justSignedUp) {
      sessionStorage.removeItem(NEW_USER_KEY);
      setIsNewUser(true);
      setShow(true);
    } else if (!localStorage.getItem(DISMISS_KEY)) {
      timer = window.setTimeout(() => setShow(true), 3000);
    }

    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      if (justSignedUp || !localStorage.getItem(DISMISS_KEY)) setShow(true);
    };
    const installed = () => {
      setShow(false);
      localStorage.setItem(DISMISS_KEY, "1");
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installed);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installed);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, "1");
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowGuide(true);
      return;
    }

    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (result?.outcome === "accepted") {
      setShowGuide(true);
      return;
    }
    dismiss();
  };

  if (!show) return null;

  const instructions = platform === "ios"
    ? ["Safariで、画面下の共有ボタン □↑ をタップ", "「ホーム画面に追加」を選ぶ", "右上の「追加」をタップ"]
    : platform === "android"
      ? ["Chrome右上の「⋮」メニューをタップ", "「ホーム画面に追加」または「アプリをインストール」を選ぶ", "「追加」をタップ"]
      : ["ブラウザのメニューを開く", "「インストール」または「ホーム画面に追加」を選ぶ", "追加後、ホーム画面のリュッターから開く"];

  const content = (
    <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-2xl animate-slide-up">
      {!showGuide ? (
        <>
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-2xl shadow-lg">🔔</div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-black text-slate-900">{isNewUser ? "通知を受け取るための大事な設定" : "通知を受け取りやすくする"}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">リュッターをホーム画面に追加すると、アプリのように開けて、通知の設定もできます。</p>
            </div>
            <button onClick={dismiss} aria-label="あとで設定する" className="p-1 text-xl text-slate-400 cursor-pointer">×</button>
          </div>

          <div className="mt-4 rounded-xl bg-violet-50 p-3 text-sm text-violet-950">
            <p className="font-bold">📣 受け取れるお知らせ</p>
            <p className="mt-1 text-xs leading-relaxed text-violet-800">返信・グループの新着投稿・勝負の順位変動などを見逃しにくくなります。</p>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-600">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white">1</span><span>ホーム画面に追加</span>
            <span className="h-px flex-1 bg-violet-200" />
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-600">2</span><span>通知を許可</span>
          </div>

          <button onClick={handleInstall} className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 py-3 text-sm font-black text-white shadow-lg cursor-pointer active:scale-[0.98] transition">
            ホーム画面に追加する
          </button>
          <button onClick={dismiss} className="mt-3 w-full text-xs font-bold text-slate-500 cursor-pointer">あとで設定する</button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-xl">📱</div>
            <div>
              <p className="font-black text-slate-900">あと少し！ ホーム画面に追加しよう</p>
              <p className="mt-0.5 text-xs text-slate-600">追加したあと、通知の表示で「許可」を選んでください。</p>
            </div>
          </div>
          <ol className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {instructions.map((instruction, index) => <li key={instruction} className="flex gap-2"><span className="font-black text-violet-600">{index + 1}.</span><span>{instruction}</span></li>)}
          </ol>
          <p className="mt-3 text-center text-xs text-slate-500">ホーム画面のリュッターを開いたときに、通知を「許可」してください。</p>
          <button onClick={dismiss} className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white cursor-pointer">手順を確認した</button>
        </>
      )}
    </div>
  );

  return isNewUser ? (
    <div className="fixed inset-0 z-[80] flex items-end bg-slate-950/55 p-4 sm:items-center sm:justify-center">
      <div className="w-full max-w-md">{content}</div>
      <style jsx>{`
        @keyframes slide-up { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1); }
      `}</style>
    </div>
  ) : (
    <div className="fixed bottom-20 inset-x-0 z-40 px-4 sm:bottom-6">
      <div className="mx-auto max-w-md">{content}</div>
      <style jsx>{`
        @keyframes slide-up { from { transform: translateY(24px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1); }
      `}</style>
    </div>
  );
}
