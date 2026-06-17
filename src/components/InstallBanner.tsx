"use client";

import { useEffect, useRef, useState } from "react";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [show, setShow] = useState(false);
  const timerDone = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem("install_banner_dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const timer = setTimeout(() => {
      timerDone.current = true;
      setShow(true);
    }, 3000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("install_banner_dismissed", "1");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 inset-x-0 z-40 px-4">
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 flex items-center gap-3 animate-slide-up">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center shrink-0 shadow">
          <span className="text-lg text-yellow-500 font-bold">R</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">リュッターをインストール</p>
          <p className="text-xs text-gray-500">ホーム画面に追加してすぐ使える</p>
        </div>
        <button onClick={async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result?.outcome === "accepted") setShow(false);
            setDeferredPrompt(null);
          } else {
            alert("Safariの場合:「共有」→「ホーム画面に追加」");
          }
          dismiss();
        }} className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-lg cursor-pointer active:scale-95 transition shrink-0">
          追加
        </button>
        <button onClick={dismiss} className="text-gray-400 text-lg cursor-pointer shrink-0">
          <i className="fas fa-times" />
        </button>
      </div>
      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.35s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </div>
  );
}
